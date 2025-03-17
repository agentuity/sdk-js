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
	AgentResponseData,
	GetAgentRequestParams,
	RemoteAgent,
	AgentConfig,
	AgentRedirectResponse,
	Data,
} from '../types';
import AgentRequestHandler from './request';
import AgentResponseHandler from './response';
import type { Logger } from '../logger';
import AgentResolver from '../server/agents';
import { DataHandler } from './data';

interface RouterConfig {
	handler: AgentHandler;
	context: AgentContext;
	port: number;
}

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
	} else {
		console.error(ex);
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
						const res = await remoteAgent.run(...params);
						span.setStatus({ code: SpanStatusCode.OK });
						return res;
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
	return async (req: ServerRequest): Promise<AgentResponseData> => {
		const agentId = config.context.agent.id;
		const runId = req.request.runId;
		const logger = config.context.logger.child({
			'@agentuity/agentId': agentId,
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
							logger,
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
								handlerResponse = await response.text(handlerResponse);
							} else if (
								'contentType' in handlerResponse &&
								'payload' in handlerResponse
							) {
								handlerResponse = {
									data: handlerResponse as unknown as Data,
									metadata: handlerResponse.metadata,
								};
							} else if (
								'redirect' in handlerResponse &&
								handlerResponse.redirect &&
								'agent' in handlerResponse
							) {
								const redirect =
									handlerResponse as unknown as AgentRedirectResponse;
								const agent = await context.getAgent(redirect.agent);
								req.setTimeout(255); // increase the timeout for the redirect
								const redirectResponse = await agentRedirectRun(
									logger,
									config,
									runId,
									config.context.agent,
									agent,
									[redirect.invocation ?? req.request]
								);
								span.setStatus({ code: SpanStatusCode.OK });
								return {
									data: new DataHandler(redirectResponse),
									metadata: redirectResponse.metadata,
								};
							}

							span.setStatus({ code: SpanStatusCode.OK });
							return handlerResponse;
						} catch (err) {
							logger.error('Error in agent run: %s', err);
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
