import type {
	AgentResponseType,
	GetAgentRequestParams,
	Json,
	RemoteAgent,
} from '../types';
import { toAgentResponseJSON } from '../router';
import { POST } from '../apis/api';
import type { Logger } from '../logger';
import type { AgentConfig } from '../types';
// FIXME: add spans for these

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

	/**
	 * Runs the local agent with the provided data
	 *
	 * @param data - The data to send to the agent
	 * @param contentType - The content type of the data
	 * @param metadata - Additional metadata to include with the request
	 * @returns A promise that resolves to the agent response
	 */
	async run(
		data: Json | ArrayBuffer | string,
		contentType?: string,
		metadata?: Record<string, Json>
	): Promise<AgentResponseType> {
		// NOTE: even though the signature says it can be stuff other than a string,
		// the router will only pass strings to the agent to this local agent via redirect
		const payload = {
			trigger: 'agent',
			payload: data as string,
			contentType: contentType as string,
			metadata,
		};
		const resp = await fetch(`http://127.0.0.1:${this.port}/${this.id}`, {
			method: 'POST',
			body: JSON.stringify(payload),
			headers: {
				'Content-Type': 'application/json',
			},
		});
		const json = await resp.json();
		return {
			...json,
			agentId: this.id,
		} as AgentResponseType;
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

	/**
	 * Runs the remote agent with the provided data
	 *
	 * @param data - The data to send to the agent
	 * @param contentType - The content type of the data
	 * @param metadata - Additional metadata to include with the request
	 * @returns A promise that resolves to the agent response
	 */
	async run(
		data: Json | ArrayBuffer | string,
		contentType?: string,
		metadata?: Record<string, Json>
	): Promise<AgentResponseType> {
		const payload = toAgentResponseJSON(
			'agent',
			data,
			'base64',
			contentType,
			metadata
		);
		const resp = await POST(
			`/sdk/agent/${this.id}/run/${this.replyId}`,
			JSON.stringify(payload),
			{
				'Content-Type': 'application/json',
			}
		);
		if (resp.status !== 200) {
			throw new Error(await resp.response.text());
		}
		const respPayload = resp.json as {
			success: boolean;
			message?: string;
		};
		if (respPayload.success) {
			const started = Date.now();
			this.logger.debug(
				'waiting for remote agent response using reply id: %s',
				this.replyId
			);
			const handler = {
				resolve: (_value: AgentResponseType) => {
					return;
				},
				reject: (_reason?: any) => {
					return;
				},
			};
			const promise = new Promise<AgentResponseType>((resolve, reject) => {
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
			if ('payload' in respPayload && respPayload.payload) {
				const data = { ...respPayload };
				data.payload = Buffer.from(
					respPayload.payload as string,
					'base64'
				).toString('utf-8');
				return data;
			}
			return respPayload;
		}
		throw new Error(respPayload.message);
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
		const resp = await POST(`/sdk/agent/resolve`, JSON.stringify(params), {
			'Content-Type': 'application/json',
		});
		if (resp.status === 404) {
			if ('id' in params) {
				throw new Error(
					`agent ${params.id} not found or you don't have access to it`
				);
			}
			if ('name' in params) {
				throw new Error(
					`agent ${params.name} not found or you don't have access to it`
				);
			}
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
		if (!payload.success) {
			throw new Error(payload.message);
		}
		return new RemoteAgentInvoker(
			this.logger,
			payload.data.id,
			payload.data.name,
			payload.data.projectId,
			payload.data.description
		);
	}
}

interface PromiseWithResolver<T> {
	resolve: (value: T) => void;
	reject: (reason?: any) => void;
}

/**
 * Handles callbacks for asynchronous agent responses
 */
export class CallbackAgentHandler {
	private pending: Map<string, PromiseWithResolver<AgentResponseType>>;

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
	register(id: string, promise: PromiseWithResolver<AgentResponseType>) {
		this.pending.set(id, promise);
	}

	/**
	 * received is called when a remote agent response is received to forward to the
	 * promise callback handler.
	 */
	received(id: string, response: AgentResponseType) {
		const promise = this.pending.get(id);
		if (promise) {
			this.pending.delete(id);
			promise.resolve(response);
		}
	}
}

export const callbackAgentHandler = new CallbackAgentHandler();
