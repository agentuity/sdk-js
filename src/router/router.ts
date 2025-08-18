import { AsyncLocalStorage } from 'node:async_hooks';
import { ReadableStream } from 'node:stream/web';
import {
	type Exception,
	type Meter,
	type Span,
	SpanStatusCode,
	type Tracer,
	ValueType,
	context,
	trace,
} from '@opentelemetry/api';
import type { Logger } from '../logger';
import AgentResolver from '../server/agents';
import { HandlerParameterProvider } from '../server/handlerParameterProvider';
import type { ServerRequest, ServerRoute } from '../server/types';
import type {
	AgentConfig,
	AgentContext,
	AgentHandler,
	AgentRedirectResponse,
	AgentResponseData,
	GetAgentRequestParams,
	ReadableDataType,
	RemoteAgent,
} from '../types';
import AgentRequestHandler from './request';
import AgentResponseHandler from './response';

interface RouterConfig {
	handler: AgentHandler;
	context: AgentContext;
	port: number;
}

interface AgentContextStore {
	agentId?: string;
	agentName?: string;
	projectId?: string;
	deploymentId?: string;
	orgId?: string;
	logger?: Logger;
}

export const asyncStorage = new AsyncLocalStorage<AgentContextStore>();

// Globals to store context values
let globalTracer: Tracer | undefined;
let globalMeter: Meter | undefined;
let globalSDKVersion: string | undefined;

/**
 * Gets the tracer from the global context
 *
 * @returns The tracer instance
 * @throws Error if not set
 */
export function getTracer(): Tracer {
	if (!globalTracer) {
		throw new Error('tracer not set');
	}
	return globalTracer;
}

/**
 * Gets the meter from the global context
 *
 * @returns The meter instance
 * @throws Error if not set
 */
export function getMeter(): Meter {
	if (!globalMeter) {
		throw new Error('meter not set');
	}
	return globalMeter;
}

/**
 * get the version of the Agentuity SDK
 */
export function getSDKVersion(): string {
	if (!globalSDKVersion) {
		throw new Error('sdkVersion not set');
	}
	return globalSDKVersion;
}

/**
 * get the current executing agent details (agentId, agentName) or
 * null if not executing in an agent context
 */
export function getAgentDetail(): Record<string, string | undefined> | null {
	const store = asyncStorage.getStore();
	if (!store) return null;
	const { logger: _logger, ...details } = store;
	return Object.keys(details).length > 0 ? details : null;
}

/**
 * Records an exception in the span and logs it
 *
 * @param span - The span to record the exception in
 * @param ex - The exception to record
 */
export function recordException(span: Span, ex: unknown, skipLog = false) {
	// annotate the exception with a flag to avoid double logging
	const __exception = ex as { __exception_recorded?: true };
	if (__exception?.__exception_recorded) {
		return;
	}
	if (!skipLog) {
		const store = asyncStorage.getStore() as { logger?: Logger } | undefined;
		if (store?.logger) {
			store.logger.error('%s', ex);
		} else {
			console.error(ex);
		}
	}
	__exception.__exception_recorded = true;
	span.recordException(ex as Exception);
	span.setStatus({
		code: SpanStatusCode.ERROR,
		message: (ex as { message: string }).message,
	});
}

async function agentRedirectRun(
	logger: Logger,
	config: RouterConfig,
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

		const agentDetail: AgentContextStore = {
			agentId: remoteAgent.id,
			agentName: remoteAgent.name,
			projectId: config.context.projectId,
			deploymentId: config.context.deploymentId,
			orgId: config.context.orgId,
			logger,
		};

		// Use asyncStorage for agent details
		return await asyncStorage.run(agentDetail, async () => {
			return await context.with(spanContext, async () => {
				try {
					const res = await remoteAgent.run(...params);
					span.setStatus({ code: SpanStatusCode.OK });
					return res;
				} catch (err) {
					recordException(span, err);
					throw err;
				}
			});
		});
	} finally {
		span.end();
	}
}

function createEmptyStream() {
	return new ReadableStream({
		start(controller) {
			controller.close();
		},
	});
}

/**
 * Creates a router handler for the specified configuration
 *
 * @param config - The router configuration
 * @returns A handler function for server routes
 */
export function createRouter(config: RouterConfig): ServerRoute['handler'] {
	const requests = config.context.meter.createCounter('requests', {
		description: 'The number of requests to the agent',
		unit: 'requests',
		valueType: ValueType.INT,
	});

	let executingCount = 0;

	const executing = config.context.meter.createGauge('executing', {
		description: 'The number of requests being processed',
		unit: 'concurrent',
		valueType: ValueType.INT,
	});

	// Set globals for this router
	globalTracer = config.context.tracer;
	globalMeter = config.context.meter;
	globalSDKVersion = config.context.sdkVersion;

	return async (req: ServerRequest): Promise<AgentResponseData | Response> => {
		const agentId = config.context.agent.id;
		let runId = req.request.runId;
		if (req.headers['x-agentuity-runid']) {
			runId = req.headers['x-agentuity-runid'];
			if (runId) {
				// biome-ignore lint/performance/noDelete:
				delete req.headers['x-agentuity-runid'];
				if (req.request?.metadata?.['runid'] === runId) {
					// biome-ignore lint/performance/noDelete:
					delete req.request.metadata['runid'];
				}
			}
			req.request.runId = runId;
		}
		const logger = config.context.logger.child({
			'@agentuity/agentId': agentId,
			'@agentuity/agentName': config.context.agent.name,
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

			if (!runId) {
				runId = span.spanContext().traceId;
				req.request.runId = runId;
			}

			executingCount++;

			requests.add(1, {
				'@agentuity/projectId': config.context.projectId,
				'@agentuity/deploymentId': config.context.deploymentId,
				'@agentuity/orgId': config.context.orgId,
			});

			executing.record(executingCount, {
				'@agentuity/projectId': config.context.projectId,
				'@agentuity/deploymentId': config.context.deploymentId,
				'@agentuity/orgId': config.context.orgId,
			});

			const agentDetail: AgentContextStore = {
				agentId: config.context.agent.id,
				agentName: config.context.agent.name,
				projectId: config.context.projectId,
				deploymentId: config.context.deploymentId,
				orgId: config.context.orgId,
				logger,
			};

			return await asyncStorage.run(agentDetail, async () => {
				return await context.with(spanContext, async () => {
					const body = req.body
						? (req.body as unknown as ReadableStream<ReadableDataType>)
						: createEmptyStream();
					const headers = req.headers;
					if (req.request.metadata && !('headers' in req.request.metadata)) {
						req.request.metadata.headers = headers;
					}
					if (req.request.metadata && !('method' in req.request.metadata)) {
						req.request.metadata.method = req.method;
					}
					if (req.request.metadata && !('url' in req.request.metadata)) {
						req.request.metadata.url = req.url;
					}
					const request = new AgentRequestHandler(
						req.request.trigger,
						body,
						req.request.contentType,
						req.request.metadata ?? { headers }
					);
					const response = new AgentResponseHandler();
					const contextObj = {
						...config.context,
						logger,
						runId,
						getAgent: (params: GetAgentRequestParams) =>
							resolver.getAgent(params),
						scope: req.request.scope,
					} as AgentContext;

					// Wrap handler execution in AsyncLocalStorage scope for thread-safe parameter access
					return await HandlerParameterProvider.run(
						request,
						response,
						contextObj,
						async () => {
							try {
								let handlerResponse = await config.handler(
									request,
									response,
									contextObj
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

								if (handlerResponse instanceof Response) {
									return await handlerResponse;
								}

								if (typeof handlerResponse === 'string') {
									handlerResponse = await response.text(handlerResponse);
								} else if (
									'contentType' in handlerResponse &&
									'payload' in handlerResponse
								) {
									const r = handlerResponse as AgentResponseData;
									handlerResponse = {
										data: r.data,
										metadata: r.metadata,
									};
								} else if (
									'redirect' in handlerResponse &&
									handlerResponse.redirect &&
									'agent' in handlerResponse
								) {
									const redirect = handlerResponse as AgentRedirectResponse;
									const agent = await contextObj.getAgent(redirect.agent);
									req.setTimeout(255); // increase the timeout for the redirect
									const redirectResponse = await agentRedirectRun(
										logger,
										config,
										config.context.agent,
										agent,
										[
											redirect.invocation ?? {
												...req.request,
												data: request.data,
											},
										]
									);
									span.setStatus({ code: SpanStatusCode.OK });
									return redirectResponse;
								}

								span.setStatus({ code: SpanStatusCode.OK });
								return handlerResponse;
							} catch (err) {
								recordException(span, err);
								throw err;
							}
						}
					);
				});
			});
		} finally {
			executingCount--;
			executing.record(executingCount, {
				'@agentuity/projectId': config.context.projectId,
				'@agentuity/deploymentId': config.context.deploymentId,
				'@agentuity/orgId': config.context.orgId,
			});
			span.end();
		}
	};
}
