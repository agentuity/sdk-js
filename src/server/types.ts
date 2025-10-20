import type { ReadableStream } from 'node:stream/web';
import type { Logger } from '../logger';
import type {
	AgentConfig,
	AgentInvocationScope,
	AgentResponseData,
	AgentWelcome,
	DataPayload,
	RawNodeHTTP,
	ReadableDataType,
} from '../types';

/**
 * Represents an incoming request to the server
 */
export interface IncomingRequest extends DataPayload {
	runId: string;
	scope: AgentInvocationScope;
	http?: RawNodeHTTP;
}

/**
 * Represents a server request with URL, headers, and the incoming request
 */
export interface ServerRequest {
	method: string;
	url: string;
	request: IncomingRequest;
	headers: Record<string, string>;
	setTimeout: (val: number) => void;
	controller?: ReadableStreamDefaultController;
	body?: ReadableStream<ReadableDataType> | AsyncIterable<ReadableDataType>;
}

/**
 * Represents a route in the server
 */
export interface ServerRoute {
	path: string;
	method: 'GET' | 'POST' | 'PUT' | 'DELETE';
	handler: (req: ServerRequest) => Promise<AgentResponseData | Response>;
	agent: AgentConfig;
	welcome?: AgentWelcome;
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
