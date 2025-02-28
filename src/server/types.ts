import type { Logger } from '../logger';
import type {
	AgentConfig,
	AgentRequestType,
	AgentResponseType,
} from '../types';

/**
 * Represents an incoming request to the server
 */
export interface IncomingRequest extends AgentRequestType {
	runId: string;
}

/**
 * Represents a server request with URL, headers, and the incoming request
 */
export interface ServerRequest {
	url: string;
	request: IncomingRequest;
	headers: Record<string, string>;
}

/**
 * Represents a route in the server
 */
export interface ServerRoute {
	path: string;
	method: 'GET' | 'POST' | 'PUT' | 'DELETE';
	handler: (req: ServerRequest) => Promise<AgentResponseType>;
	agent: AgentConfig;
}

/**
 * Configuration for the unified server
 */
export interface UnifiedServerConfig {
	port: number;
	routes: ServerRoute[];
	logger: Logger;
	sdkVersion: string;
}

/**
 * Interface for server implementations
 */
export interface Server {
	start(): Promise<void>;
	stop(): Promise<void>;
}
