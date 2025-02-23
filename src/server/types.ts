import type { Logger } from "../logger";
import type { AgentRequestType, AgentResponseType } from "../types";

interface IncomingRequest extends AgentRequestType {
	runId: string;
}

export interface ServerRequest {
	url: string;
	request: IncomingRequest;
}

export interface ServerRoute {
	path: string;
	method: "GET" | "POST" | "PUT" | "DELETE";
	handler: (req: ServerRequest) => Promise<AgentResponseType>;
}

export interface UnifiedServerConfig {
	port: number;
	routes: ServerRoute[];
	logger: Logger;
}

export interface Server {
	start(): Promise<void>;
	stop(): Promise<void>;
}
