import type {
	AgentResponseType,
	GetAgentRequestParams,
	Json,
	RemoteAgent,
} from '../types';
import { toAgentResponseJSON } from '../router';
import { POST } from '../apis/api';
import type { ServerAgent } from './types';

class LocalAgentInvoker implements RemoteAgent {
	private readonly port: number;
	public readonly id: string;
	public readonly name: string;
	public readonly description?: string;
	public readonly projectId: string;

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

class RemoteAgentInvoker implements RemoteAgent {
	public readonly id: string;
	public readonly name: string;
	public readonly description?: string;
	public readonly projectId: string;

	constructor(
		id: string,
		name: string,
		projectId: string,
		description?: string
	) {
		this.id = id;
		this.name = name;
		this.projectId = projectId;
		this.description = description;
	}

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
			`/sdk/agent/${this.id}/run`,
			JSON.stringify(payload),
			{
				'Content-Type': 'application/json',
			},
			300_000 // 5 minutes
		);
		if (resp.status !== 200) {
			throw new Error(await resp.response.text());
		}
		const respPayload = resp.json as {
			success: boolean;
			data: AgentResponseType;
			message?: string;
		};
		if (respPayload.success) {
			const data = { ...respPayload.data };
			if ('payload' in respPayload.data && respPayload.data.payload) {
				data.payload = Buffer.from(
					respPayload.data.payload as string,
					'base64'
				).toString('utf-8');
			}
			return data;
		}
		throw new Error(respPayload.message);
	}
}

export default class AgentResolver {
	private readonly agents: ServerAgent[];
	private readonly port: number;
	private readonly projectId: string;
	private readonly currentAgentId: string;

	constructor(
		agents: ServerAgent[],
		port: number,
		projectId: string,
		currentAgentId: string
	) {
		this.agents = agents;
		this.port = port;
		this.projectId = projectId;
		this.currentAgentId = currentAgentId;
	}

	async getAgent(params: GetAgentRequestParams): Promise<RemoteAgent> {
		const agent = this.agents.find((a) => {
			if ('id' in params && a.id === params.id) {
				return a;
			}
			if ('name' in params && a.name === params.name) {
				return a;
			}
			if ('name' in params && a.path === params.name) {
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
			payload.data.id,
			payload.data.name,
			payload.data.projectId,
			payload.data.description
		);
	}
}
