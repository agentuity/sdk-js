import { AsyncLocalStorage } from 'node:async_hooks';
import {
	SpanStatusCode,
	type Exception,
	type Tracer,
	type Span,
} from '@opentelemetry/api';
import type { ServerRoute, ServerRequest } from '../server/types';
import type {
	AgentHandler,
	AgentContext,
	AgentResponseType,
	Json,
	GetAgentRequestParams,
	RemoteAgent,
	AgentConfig,
} from '../types';
import AgentRequestHandler from './request';
import AgentResponseHandler from './response';
import type { Logger } from '../logger';
import AgentResolver from '../server/agents';

interface RouterConfig {
	handler: AgentHandler;
	context: AgentContext;
	port: number;
}

const isCURLUserAgent = (req: ServerRequest) => {
	const ua = req.headers['user-agent'];
	return ua?.includes('curl');
};

function toBase64(payload: Json | ArrayBuffer | string | undefined) {
	if (payload instanceof ArrayBuffer) {
		return Buffer.from(payload).toString('base64');
	}
	if (typeof payload === 'string') {
		return Buffer.from(payload).toString('base64');
	}
	if (payload instanceof Object) {
		return Buffer.from(JSON.stringify(payload)).toString('base64');
	}
	return payload;
}

/**
 * Converts an agent response to JSON format
 *
 * @param trigger - The trigger for the response
 * @param payload - The payload of the response
 * @param encoding - The encoding to use for the payload
 * @param contentType - The content type of the payload
 * @param metadata - Additional metadata for the response
 * @returns The formatted agent response
 */
export const toAgentResponseJSON = (
	trigger: string,
	payload: Json | ArrayBuffer | string | undefined,
	encoding: 'base64' | 'utf-8',
	contentType?: string,
	metadata?: Record<string, Json>
): AgentResponseType => {
	const resp: {
		trigger: string;
		payload: string;
		contentType: string;
		metadata?: Record<string, Json>;
	} = {
		trigger,
		payload: '',
		contentType: contentType ?? 'text/plain',
		metadata,
	};
	if (payload) {
		if (typeof payload === 'string') {
			resp.contentType = contentType ?? 'text/plain';
			resp.payload = Buffer.from(payload, 'utf-8').toString(encoding);
		} else if (payload instanceof ArrayBuffer) {
			resp.contentType = contentType ?? 'application/octet-stream';
			resp.payload = Buffer.from(payload).toString(encoding);
		} else if (payload instanceof Object) {
			resp.contentType = contentType ?? 'application/json';
			resp.payload = Buffer.from(JSON.stringify(payload), 'utf-8').toString(
				encoding
			);
		} else {
			throw new Error('invalid payload type: ' + typeof payload);
		}
	}
	return resp as AgentResponseType;
};

const toServerResponseJSON = (req: ServerRequest, data: AgentResponseType) => {
	if ('payload' in data) {
		const isCURL = isCURLUserAgent(req);
		const encoding = isCURL ? 'utf-8' : 'base64';
		return toAgentResponseJSON(
			req.request.trigger,
			data.payload,
			encoding,
			'contentType' in data ? data.contentType : undefined,
			data.metadata
		);
	}
	return data;
};

/**
 * Storage for async local context
 */
export const asyncStorage = new AsyncLocalStorage();

/**
 * Gets the tracer from the async local storage
 *
 * @returns The tracer instance
 * @throws Error if no store is found
 */
export function getTracer(): Tracer {
	const store = asyncStorage.getStore();
	if (!store) {
		throw new Error('no store');
	}
	const { tracer } = store as { tracer: Tracer };
	return tracer;
}

/**
 * get the version of the Agentuity SDK
 */
export function getSDKVersion(): string {
	const store = asyncStorage.getStore();
	if (!store) {
		throw new Error('no store');
	}
	const { sdkVersion } = store as { sdkVersion: string };
	return sdkVersion;
}

/**
 * Records an exception in the span and logs it
 *
 * @param span - The span to record the exception in
 * @param ex - The exception to record
 */
export function recordException(span: Span, ex: unknown) {
	const { logger } = asyncStorage.getStore() as { logger: Logger };
	if (logger) {
		logger.error('%s', ex);
	}
	span.recordException(ex as Exception);
	span.setStatus({
		code: SpanStatusCode.ERROR,
		message: (ex as { message: string }).message,
	});
}

/**
 * Generates a unique agent ID based on project ID and agent name
 *
 * @param projectId - The project ID
 * @param agentName - The agent name
 * @returns A unique agent ID
 */
export async function getAgentId(
	projectId: string,
	agentName: string
): Promise<string> {
	const hashInput = `${projectId}:${agentName}`;
	const encoder = new TextEncoder();
	const data = encoder.encode(hashInput);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function agentRedirectRun(
	logger: Logger,
	config: RouterConfig,
	runId: string,
	fromAgent: AgentConfig & { id: string },
	remoteAgent: RemoteAgent,
	params: Parameters<RemoteAgent['run']>
): Promise<ReturnType<RemoteAgent['run']>> {
	return new Promise((resolve, reject) => {
		return config.context.tracer.startActiveSpan(
			'agent.redirect',
			{
				attributes: {
					fromAgentName: fromAgent.name,
					fromAgentId: fromAgent.id,
					toAgentName: remoteAgent.name,
					toAgentId: remoteAgent.id,
				},
			},
			async (span) => {
				asyncStorage.run(
					{
						span,
						runId,
						projectId: config.context.projectId,
						deploymentId: config.context.deploymentId,
						orgId: config.context.orgId,
						agentId: remoteAgent.id,
						logger,
						tracer: config.context.tracer,
						sdkVersion: config.context.sdkVersion,
					},
					async () => {
						try {
							resolve(await remoteAgent.run(...params));
						} catch (err) {
							recordException(span, err);
							reject(err);
						} finally {
							span.end();
						}
					}
				);
			}
		);
	});
}

/**
 * Creates a router handler for the specified configuration
 *
 * @param config - The router configuration
 * @returns A handler function for server routes
 */
export function createRouter(config: RouterConfig): ServerRoute['handler'] {
	return async (req: ServerRequest): Promise<AgentResponseType> => {
		return new Promise((resolve, reject) => {
			return getAgentId(config.context.projectId, config.context.agent.name)
				.then((agentId) => {
					const logger = config.context.logger.child({
						runId: req.request.runId,
					});
					const resolver = new AgentResolver(
						logger,
						config.context.agents,
						config.port,
						config.context.projectId,
						agentId
					);
					return config.context.tracer.startActiveSpan(
						'agent.run',
						{
							attributes: {
								agentName: config.context.agent.name,
								agentId,
							},
						},
						async (span) => {
							asyncStorage.run(
								{
									span,
									runId: req.request.runId,
									projectId: config.context.projectId,
									deploymentId: config.context.deploymentId,
									orgId: config.context.orgId,
									agentId,
									logger,
									tracer: config.context.tracer,
									sdkVersion: config.context.sdkVersion,
								},
								async () => {
									const request = new AgentRequestHandler(req.request);
									const response = new AgentResponseHandler();
									const context = {
										...config.context,
										runId: req.request.runId,
										getAgent: (params: GetAgentRequestParams) =>
											resolver.getAgent(params),
									} as AgentContext;
									try {
										let handlerResponse = await config.handler(
											request,
											response,
											context
										);
										if (handlerResponse === undefined) {
											throw new Error(
												'handler returned undefined instead of a response'
											);
										}
										if (handlerResponse === null) {
											throw new Error(
												'handler returned null instead of a response'
											);
										}
										if (typeof handlerResponse === 'string') {
											handlerResponse = response.text(handlerResponse);
										} else if (
											typeof handlerResponse === 'object' &&
											!('contentType' in handlerResponse)
										) {
											handlerResponse = response.json(handlerResponse as Json);
										}
										// handle local redirect
										if (
											'redirect' in handlerResponse &&
											handlerResponse.redirect
										) {
											const agent = await context.getAgent(
												handlerResponse.agent
											);
											const val = await agentRedirectRun(
												logger,
												config,
												req.request.runId,
												{ ...config.context.agent, id: agentId },
												agent,
												[
													handlerResponse.payload
														? toBase64(handlerResponse.payload)
														: req.request.payload,
													handlerResponse.contentType ??
														req.request.contentType,
													handlerResponse.metadata ?? req.request.metadata,
												]
											);
											logger.debug(
												'redirect response: %s',
												JSON.stringify(val)
											);
											if (
												isCURLUserAgent(req) &&
												'payload' in val &&
												val.payload
											) {
												val.payload = Buffer.from(
													val.payload as string,
													'base64'
												).toString('utf-8');
											}
											span.setStatus({
												code: SpanStatusCode.OK,
												message: JSON.stringify(val),
											});
											resolve(val);
											return;
										}
										const data = toServerResponseJSON(req, handlerResponse);
										if (config.context.devmode) {
											logger.info(
												`${config.context.agent.name} returned: ${JSON.stringify(
													data
												)}`
											);
										}
										span.setStatus({
											code: SpanStatusCode.OK,
										});
										resolve(data);
									} catch (err) {
										recordException(span, err);
										reject(err);
									} finally {
										span.end();
									}
								}
							);
						}
					);
				})
				.catch(reject);
		});
	};
}
