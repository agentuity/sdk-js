import type {
	GetAgentRequestParams,
	RemoteAgent,
	InvocationArguments,
	RemoteAgentResponse,
	DataPayload,
} from '../types';
import { POST } from '../apis/api';
import type { Logger } from '../logger';
import type { AgentConfig } from '../types';
import { toDataType, safeStringify } from './util';
import { injectTraceContextToHeaders } from './otel';
import { DataHandler } from '../router/data';
import { getTracer, recordException } from '../router/router';
import { context, SpanStatusCode } from '@opentelemetry/api';

/**
 * Invokes local agents within the same server
 */
class LocalAgentInvoker implements RemoteAgent {
	private readonly port: number;
	public readonly id: string;
	public readonly name: string;
	public readonly description?: string;
	public readonly projectId: string;

	/**
	 * Creates a new local agent invoker
	 *
	 * @param port - The port the agent is running on
	 * @param id - The agent ID
	 * @param name - The agent name
	 * @param projectId - The project ID
	 * @param description - Optional description of the agent
	 */
	constructor(
		port: number,
		id: string,
		name: string,
		projectId: string,
		description?: string
	) {
		this.port = port;
		this.id = id;
		this.name = name;
		this.projectId = projectId;
		this.description = description;
	}

	async run(args?: InvocationArguments): Promise<RemoteAgentResponse> {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan(
			'remoteagent.run',
			{
				attributes: {
					'remote.agentId': this.id,
					'remote.agentName': this.name,
					scope: 'local',
				},
			},
			currentContext
		);
		try {
			const body = await toDataType(
				'agent',
				args as unknown as InvocationArguments
			);
			const headers = {};
			injectTraceContextToHeaders(headers);
			const resp = await fetch(`http://127.0.0.1:${this.port}/${this.id}`, {
				method: 'POST',
				body: safeStringify(body),
				headers: {
					...headers,
					'Content-Type': 'application/json',
				},
			});
			if (resp.ok) {
				const result = (await resp.json()) as DataPayload;
				span.setAttribute('http.status_code', resp.status.toString());
				span.setStatus({ code: SpanStatusCode.OK });
				return {
					data: new DataHandler(result),
					contentType: result.contentType,
					metadata: result.metadata,
				};
			}
			throw new Error(await resp.text());
		} catch (ex) {
			recordException(span, ex);
			throw ex;
		} finally {
			span.end();
		}
	}
}

/**
 * Invokes remote agents through the API
 */
class RemoteAgentInvoker implements RemoteAgent {
	private readonly logger: Logger;
	public readonly id: string;
	public readonly name: string;
	public readonly description?: string;
	public readonly projectId: string;
	private readonly replyId: string;

	/**
	 * Creates a new remote agent invoker
	 *
	 * @param logger - The logger to use
	 * @param id - The agent ID
	 * @param name - The agent name
	 * @param projectId - The project ID
	 * @param description - Optional description of the agent
	 */
	constructor(
		logger: Logger,
		id: string,
		name: string,
		projectId: string,
		description?: string
	) {
		this.logger = logger;
		this.id = id;
		this.name = name;
		this.projectId = projectId;
		this.description = description;
		this.replyId = crypto.randomUUID();
	}

	async run(args?: InvocationArguments): Promise<RemoteAgentResponse> {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan(
			'remoteagent.run',
			{
				attributes: {
					'remote.agentId': this.id,
					'remote.agentName': this.name,
					scope: 'remote',
				},
			},
			currentContext
		);
		try {
			const body = await toDataType(
				'agent',
				args as unknown as InvocationArguments
			);
			const headers = {};
			injectTraceContextToHeaders(headers);
			const resp = await POST<{ success: boolean; message?: string }>(
				`/sdk/agent/${this.id}/run/${this.replyId}`,
				safeStringify(body),
				{
					...headers,
					'Content-Type': 'application/json',
				}
			);
			span.setAttribute('http.status_code', resp.status.toString());
			const respPayload = resp.json;
			if (respPayload?.success) {
				const started = Date.now();
				this.logger.debug(
					'waiting for remote agent response using reply id: %s',
					this.replyId
				);
				const handler = {
					resolve: (_value: DataPayload) => {
						return;
					},
					reject: (_reason?: Error) => {
						return;
					},
				};
				const promise = new Promise<DataPayload>((resolve, reject) => {
					handler.resolve = resolve;
					handler.reject = reject;
				});
				callbackAgentHandler.register(this.replyId, handler);
				const respPayload = await promise;
				this.logger.debug(
					'received remote agent reply with id: %s after %s ms',
					this.replyId,
					Date.now() - started
				);
				span.setStatus({ code: SpanStatusCode.OK });
				return {
					data: new DataHandler(respPayload),
					contentType: respPayload.contentType,
					metadata: respPayload.metadata,
				};
			}
			throw new Error(
				respPayload?.message ?? 'unknown error from agent response'
			);
		} catch (ex) {
			recordException(span, ex);
			throw ex;
		} finally {
			span.end();
		}
	}
}

/**
 * Resolves agent references to concrete agent implementations
 */
export default class AgentResolver {
	private readonly logger: Logger;
	private readonly agents: AgentConfig[];
	private readonly port: number;
	private readonly projectId: string;
	private readonly currentAgentId: string;

	/**
	 * Creates a new agent resolver
	 *
	 * @param logger - The logger to use
	 * @param agents - List of available server agents
	 * @param port - The port the server is running on
	 * @param projectId - The project ID
	 * @param currentAgentId - The ID of the current agent
	 */
	constructor(
		logger: Logger,
		agents: AgentConfig[],
		port: number,
		projectId: string,
		currentAgentId: string
	) {
		this.logger = logger;
		this.agents = agents;
		this.port = port;
		this.projectId = projectId;
		this.currentAgentId = currentAgentId;
	}

	/**
	 * Gets an agent implementation based on the provided parameters
	 *
	 * @param params - Parameters to identify the agent
	 * @returns A promise that resolves to the agent implementation
	 * @throws Error if the agent is not found or if there's an agent loop
	 */
	async getAgent(params: GetAgentRequestParams): Promise<RemoteAgent> {
		const agent = this.agents.find((a) => {
			if ('id' in params && a.id === params.id) {
				return a;
			}
			if ('name' in params && a.name === params.name) {
				return a;
			}
			return null;
		});
		if (agent) {
			if (agent.id === this.currentAgentId) {
				throw new Error(
					'agent loop detected trying to redirect to the current active agent'
				);
			}
			return new LocalAgentInvoker(
				this.port,
				agent.id,
				agent.name,
				this.projectId,
				agent.description
			);
		}

		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan(
			'remoteagent.run',
			{
				attributes: {
					scope: 'remote',
				},
			},
			currentContext
		);
		if ('id' in params) {
			span.setAttribute('remote.agentId', params.id);
		}
		if ('name' in params) {
			span.setAttribute('remote.agentName', params.name);
		}
		try {
			const resp = await POST('/sdk/agent/resolve', safeStringify(params), {
				'Content-Type': 'application/json',
			});
			if (resp.status === 404) {
				if ('id' in params) {
					span.setStatus({
						code: SpanStatusCode.ERROR,
						message: `agent ${params.id} not found or you don't have access to it`,
					});
					throw new Error(
						`agent ${params.id} not found or you don't have access to it`
					);
				}
				if ('name' in params) {
					span.setStatus({
						code: SpanStatusCode.ERROR,
						message: `agent ${params.id} not found or you don't have access to it`,
					});
					throw new Error(
						`agent ${params.name} not found or you don't have access to it`
					);
				}
				span.setStatus({
					code: SpanStatusCode.ERROR,
					message: "agent not found or you don't have access to it",
				});
				throw new Error("agent not found or you don't have access to it");
			}
			const payload = resp.json as {
				success: boolean;
				message?: string;
				data: {
					id: string;
					name: string;
					projectId: string;
					description?: string;
				};
			};
			if (!payload?.success) {
				span.setStatus({
					code: SpanStatusCode.ERROR,
					message: payload?.message ?? 'unknown error from agent response',
				});
				throw new Error(
					payload?.message ?? 'unknown error from agent response'
				);
			}
			span.setStatus({ code: SpanStatusCode.OK });
			return new RemoteAgentInvoker(
				this.logger,
				payload.data.id,
				payload.data.name,
				payload.data.projectId,
				payload.data.description
			);
		} catch (ex) {
			recordException(span, ex);
			throw ex;
		} finally {
			span.end();
		}
	}
}

interface PromiseWithResolver<T> {
	resolve: (value: T) => void;
	reject: (reason?: Error) => void;
}

/**
 * Handles callbacks for asynchronous agent responses
 */
export class CallbackAgentHandler {
	private pending: Map<string, PromiseWithResolver<DataPayload>>;

	/**
	 * Creates a new callback agent handler
	 */
	constructor() {
		this.pending = new Map();
	}

	/**
	 * register is called to register a promise callback handler for a pending
	 * remote agent response.
	 */
	register(id: string, promise: PromiseWithResolver<DataPayload>) {
		this.pending.set(id, promise);
	}

	/**
	 * received is called when a remote agent response is received to forward to the
	 * promise callback handler.
	 */
	received(id: string, response: DataPayload) {
		const promise = this.pending.get(id);
		if (promise) {
			this.pending.delete(id);
			promise.resolve(response);
		}
	}
}

export const callbackAgentHandler = new CallbackAgentHandler();
