import { AsyncLocalStorage } from 'node:async_hooks';
import {
	SpanKind,
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
		if (payload instanceof ArrayBuffer) {
			resp.contentType = contentType ?? 'application/octet-stream';
			resp.payload = Buffer.from(payload).toString(encoding);
		} else if (payload instanceof Object) {
			resp.contentType = contentType ?? 'application/json';
			resp.payload = Buffer.from(JSON.stringify(payload)).toString(encoding);
		} else if (typeof payload === 'string') {
			resp.contentType = contentType ?? 'text/plain';
			resp.payload = Buffer.from(payload).toString(encoding);
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

export const asyncStorage = new AsyncLocalStorage();

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

// for a given project id and agent name, create a unique agent id
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

export function createRouter(config: RouterConfig): ServerRoute['handler'] {
	return async (req: ServerRequest): Promise<AgentResponseType> => {
		return new Promise((resolve, reject) => {
			return getAgentId(config.context.projectId, config.context.agent.name)
				.then((agentId) => {
					const resolver = new AgentResolver(
						config.context.agents,
						config.port,
						config.context.projectId,
						agentId
					);
					return config.context.tracer.startActiveSpan(
						config.context.agent.name,
						{
							kind: SpanKind.SERVER,
							attributes: {
								action: 'agent.run',
								agent: config.context.agent.name,
								agentId,
							},
						},
						async (span) => {
							const logger = config.context.logger.child({
								runId: req.request.runId,
							});
							asyncStorage.run(
								{
									span,
									runId: req.request.runId,
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
										// handle local redirect
										if (
											'redirect' in handlerResponse &&
											handlerResponse.redirect
										) {
											const resp = await context.getAgent(
												handlerResponse.agent
											);
											logger.info(
												'sending redirect to %s',
												handlerResponse.agent
											);
											const val = await resp.run(
												req.request.payload,
												req.request.contentType,
												handlerResponse.metadata ?? req.request.metadata
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
