import type { Logger } from '../logger';
import type { AgentRequestType, AgentResponseType } from '../types';

export interface IncomingRequest extends AgentRequestType {
	runId: string;
}

export interface ServerRequest {
	url: string;
	request: IncomingRequest;
	headers: Record<string, string>;
}

export interface ServerRoute {
	path: string;
	method: 'GET' | 'POST' | 'PUT' | 'DELETE';
	handler: (req: ServerRequest) => Promise<AgentResponseType>;
}

export interface UnifiedServerConfig {
	port: number;
	routes: ServerRoute[];
	logger: Logger;
	sdkVersion: string;
}

export interface Server {
	start(): Promise<void>;
	stop(): Promise<void>;
}
