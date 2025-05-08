import type {
	GetAgentRequestParams,
	RemoteAgent,
	InvocationArguments,
	RemoteAgentResponse,
	ReadableDataType,
} from '../types';
import type { ReadableStream } from 'node:stream/web';
import { POST } from '../apis/api';
import type { Logger } from '../logger';
import type { AgentConfig } from '../types';
import {
	safeStringify,
	metadataFromHeaders,
	setMetadataInHeaders,
	dataTypeToBuffer,
	headersToRecord,
} from './util';
import { injectTraceContextToHeaders } from './otel';
import { DataHandler } from '../router/data';
import { getSDKVersion, getTracer, recordException } from '../router/router';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';

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
					'@agentuity/scope': 'local',
				},
			},
			currentContext
		);

		const spanContext = trace.setSpan(currentContext, span);

		// Execute the operation within the new context
		return await context.with(spanContext, async () => {
			try {
				const body = args?.data ? await dataTypeToBuffer(args.data) : undefined;
				const headers: Record<string, string> = {
					'Content-Type': args?.contentType ?? 'application/octet-stream',
					'x-agentuity-trigger': 'agent',
				};
				if (args?.metadata) {
					setMetadataInHeaders(headers, args.metadata);
				}
				injectTraceContextToHeaders(headers);
				const resp = await fetch(`http://127.0.0.1:${this.port}/${this.id}`, {
					method: 'POST',
					body,
					headers,
				});
				if (resp.ok) {
					span.setAttribute('http.status_code', resp.status.toString());
					if (resp.body) {
						span.setStatus({ code: SpanStatusCode.OK });
						return {
							data: new DataHandler(
								resp.body as unknown as ReadableStream<ReadableDataType>,
								resp.headers.get('content-type') ?? 'application/octet-stream'
							),
							contentType:
								resp.headers.get('content-type') ?? 'application/octet-stream',
							metadata: metadataFromHeaders(headersToRecord(resp.headers)),
						};
					}
				}
				throw new Error(await resp.text());
			} catch (ex) {
				recordException(span, ex);
				throw ex;
			} finally {
				span.end();
			}
		});
	}
}

/**
 * Invokes remote agents through the API
 */
class RemoteAgentInvoker implements RemoteAgent {
	private readonly logger: Logger;
	public readonly id: string;
	public readonly name: string;
	public readonly projectId: string;
	public readonly orgId: string;
	private readonly url: string;
	private readonly authorization: string;
	private readonly transactionId: string;

	/**
	 * Creates a new remote agent invoker
	 *
	 * @param logger - The logger to use
	 * @param url - The agent url endpoint to use
	 * @param authorization - The agent authorization token
	 * @param id - The agent id
	 * @param name - The agent name
	 * @param projectId - The project id
	 * @param orgId - The organization id
	 * @param transactionId - The transaction id
	 */
	constructor(
		logger: Logger,
		url: string,
		authorization: string,
		id: string,
		name: string,
		projectId: string,
		orgId: string,
		transactionId: string
	) {
		this.logger = logger;
		this.url = url;
		this.authorization = authorization;
		this.id = id;
		this.name = name;
		this.projectId = projectId;
		this.orgId = orgId;
		this.transactionId = transactionId;
	}

	async run(args?: InvocationArguments): Promise<RemoteAgentResponse> {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan(
			'remoteagent.run',
			{
				attributes: {
					'@agentuity/agentId': this.id,
					'@agentuity/agentName': this.name,
					'@agentuity/orgId': this.orgId,
					'@agentuity/projectId': this.projectId,
					'@agentuity/transactionId': this.transactionId,
					'@agentuity/scope': 'remote',
				},
			},
			currentContext
		);

		const spanContext = trace.setSpan(currentContext, span);

		// Execute the operation within the new context
		return await context.with(spanContext, async () => {
			try {
				const sdkVersion = getSDKVersion();
				const headers: Record<string, string> = {
					Authorization: `Bearer ${this.authorization}`,
					'Content-Type': args?.contentType ?? 'application/octet-stream',
					'User-Agent': `Agentuity JS SDK/${sdkVersion}`,
					'x-agentuity-scope': 'remote',
					'x-agentuity-trigger': 'agent',
				};
				if (args?.metadata) {
					setMetadataInHeaders(headers, args.metadata);
				}
				injectTraceContextToHeaders(headers);
				const body = args?.data ? await dataTypeToBuffer(args.data) : undefined;
				this.logger.info('invoking remote agent');
				const resp = await fetch(this.url, {
					headers,
					body,
					method: 'POST',
				});
				this.logger.info('invoked remote agent, returned: %d', resp.status);
				span.setAttribute('http.status_code', resp.status);
				if (resp.ok) {
					span.setStatus({ code: SpanStatusCode.OK });
				} else {
					span.setStatus({
						code: SpanStatusCode.ERROR,
						message: await resp.text(),
					});
					throw new Error(await resp.text());
				}
				const metadata = metadataFromHeaders(headersToRecord(resp.headers));
				const contentType =
					resp.headers.get('content-type') ?? 'application/octet-stream';
				this.logger.debug(
					'invoked remote agent, returned metadata: %s, content-type: %s',
					metadata,
					contentType
				);
				return {
					data: new DataHandler(
						resp.body as unknown as ReadableStream<ReadableDataType>,
						contentType
					),
					metadata,
				};
			} catch (ex) {
				recordException(span, ex);
				throw ex;
			} finally {
				span.end();
			}
		});
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
			if (
				'name' in params &&
				a.name === params.name &&
				(this.projectId === params.projectId || !params.projectId)
			) {
				return a;
			}
			return null;
		});
		if (agent) {
			if (agent.id === this.currentAgentId) {
				throw new Error(
					'agent loop detected trying to redirect to the current active agent. if you are trying to redirect to another agent in a different project with the same name, you must specify the projectId parameter along with the name parameter'
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
		const span = tracer.startSpan('remoteagent.resolve', {}, currentContext);
		const spanContext = trace.setSpan(currentContext, span);

		// Execute the operation within the new context
		return await context.with(spanContext, async () => {
			if ('id' in params) {
				span.setAttribute('remote.agentId', params.id);
			}
			if ('name' in params) {
				span.setAttribute('remote.agentName', params.name);
			}
			try {
				const resp = await POST(
					'/agent/2025-03-17/resolve',
					safeStringify(params),
					{
						'Content-Type': 'application/json',
					}
				);
				span.setAttribute('http.status_code', resp.status);
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
							message: `agent ${params.name} not found or you don't have access to it`,
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
						url: string;
						authorization: string;
						orgId: string;
						transactionId: string;
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
					payload.data.url,
					payload.data.authorization,
					payload.data.id,
					payload.data.name,
					payload.data.projectId,
					payload.data.orgId,
					payload.data.transactionId
				);
			} catch (ex) {
				recordException(span, ex);
				throw ex;
			} finally {
				span.end();
			}
		});
	}
}
