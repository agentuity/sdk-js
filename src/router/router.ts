import { AsyncLocalStorage } from 'node:async_hooks';
import {
	SpanStatusCode,
	type Exception,
	type Tracer,
	type Span,
	context,
	trace,
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
import { safeStringify } from '../server/util';

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
		return Buffer.from(safeStringify(payload)).toString('base64');
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
			resp.payload = Buffer.from(safeStringify(payload), 'utf-8').toString(
				encoding
			);
		} else {
			throw new Error(`invalid payload type: ${typeof payload}`);
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

async function agentRedirectRun(
	logger: Logger,
	config: RouterConfig,
	runId: string,
	fromAgent: AgentConfig,
	remoteAgent: RemoteAgent,
	params: Parameters<RemoteAgent['run']>
): Promise<ReturnType<RemoteAgent['run']>> {
	// Get the current active context
	const currentContext = context.active();

	// Create a child span using the current context
	const span = config.context.tracer.startSpan(
		'agent.redirect',
		{
			attributes: {
				fromAgentName: fromAgent.name,
				fromAgentId: fromAgent.id,
				toAgentName: remoteAgent.name,
				toAgentId: remoteAgent.id,
			},
		},
		currentContext
	);

	try {
		// Create a new context with the child span
		const spanContext = trace.setSpan(currentContext, span);

		// Execute the operation within the new context
		return await asyncStorage.run(
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
				return await context.with(spanContext, async () => {
					try {
						return await remoteAgent.run(...params);
					} catch (err) {
						recordException(span, err);
						throw err;
					}
				});
			}
		);
	} finally {
		span.end();
	}
}

/**
 * Creates a router handler for the specified configuration
 *
 * @param config - The router configuration
 * @returns A handler function for server routes
 */
export function createRouter(config: RouterConfig): ServerRoute['handler'] {
	return async (req: ServerRequest): Promise<AgentResponseType> => {
		const agentId = config.context.agent.id;
		const runId = req.request.runId;
		const logger = config.context.logger.child({
			runId,
		});
		const resolver = new AgentResolver(
			logger,
			config.context.agents,
			config.port,
			config.context.projectId,
			agentId
		);

		// Get the current active context
		const currentContext = context.active();

		// Create a child span using the current context
		const span = config.context.tracer.startSpan(
			'agent.run',
			{
				attributes: {
					'@agentuity/agentName': config.context.agent.name,
					'@agentuity/agentId': agentId,
				},
			},
			currentContext
		);

		try {
			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await asyncStorage.run(
				{
					span,
					runId,
					projectId: config.context.projectId,
					deploymentId: config.context.deploymentId,
					orgId: config.context.orgId,
					agentId,
					logger,
					tracer: config.context.tracer,
					sdkVersion: config.context.sdkVersion,
				},
				async () => {
					return await context.with(spanContext, async () => {
						const request = new AgentRequestHandler(req.request);
						const response = new AgentResponseHandler();
						const context = {
							...config.context,
							runId,
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
								throw new Error('handler returned null instead of a response');
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
							if ('redirect' in handlerResponse && handlerResponse.redirect) {
								const agent = await context.getAgent(handlerResponse.agent);
								const val = await agentRedirectRun(
									logger,
									config,
									runId,
									{ ...config.context.agent, id: agentId },
									agent,
									[
										handlerResponse.payload
											? toBase64(handlerResponse.payload)
											: req.request.payload,
										handlerResponse.contentType ?? req.request.contentType,
										handlerResponse.metadata ?? req.request.metadata,
									]
								);
								logger.debug('redirect response: %s', safeStringify(val));
								if (isCURLUserAgent(req) && 'payload' in val && val.payload) {
									val.payload = Buffer.from(
										val.payload as string,
										'base64'
									).toString('utf-8');
								}
								span.setStatus({ code: SpanStatusCode.OK });
								return val;
							}
							const data = toServerResponseJSON(req, handlerResponse);
							if (config.context.devmode) {
								logger.info(
									`${config.context.agent.name} returned: ${safeStringify(
										data
									)}`
								);
							}
							span.setStatus({ code: SpanStatusCode.OK });
							return data;
						} catch (err) {
							recordException(span, err);
							throw err;
						}
					});
				}
			);
		} finally {
			span.end();
		}
	};
}
