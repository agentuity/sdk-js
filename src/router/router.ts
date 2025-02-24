import { AsyncLocalStorage } from 'node:async_hooks';
import {
	SpanKind,
	SpanStatusCode,
	type Exception,
	type Tracer,
	type Span,
} from '@opentelemetry/api';
import type { ServerRoute, ServerRequest } from '../server/types';
import type { AgentHandler, AgentContext, AgentResponseType } from '../types';
import AgentRequestHandler from './request';
import AgentResponseHandler from './response';
import type { Logger } from '../logger';

interface RouterConfig {
	handler: AgentHandler;
	context: AgentContext;
}

const toResponseJSON = (data: AgentResponseType) => {
	const resp = { ...data };
	if (resp.payload) {
		if (resp.payload instanceof ArrayBuffer) {
			resp.payload = Buffer.from(resp.payload).toString('base64');
		} else if (resp.payload instanceof Object) {
			resp.payload = Buffer.from(JSON.stringify(resp.payload)).toString(
				'base64'
			);
		} else if (typeof resp.payload === 'string') {
			resp.payload = Buffer.from(resp.payload).toString('base64');
		}
	}
	return resp;
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
export async function createAgentId(
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
			return createAgentId(config.context.projectId, config.context.agent.name)
				.then((agentId) => {
					return config.context.tracer.startActiveSpan(
						config.context.agent.name,
						{
							kind: SpanKind.SERVER,
							attributes: {
								agent: config.context.agent.name,
								agentId,
								runId: req.request.runId,
								deploymentId: config.context.deploymentId,
								projectId: config.context.projectId,
								orgId: config.context.orgId,
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
								},
								async () => {
									const request = new AgentRequestHandler(req.request);
									const response = new AgentResponseHandler();
									const context = {
										...config.context,
										runId: req.request.runId,
									} as AgentContext;
									try {
										const handlerResponse = await config.handler(
											request,
											response,
											context
										);
										const data = toResponseJSON(handlerResponse);
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
