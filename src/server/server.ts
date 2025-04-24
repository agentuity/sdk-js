import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Tracer, Meter } from '@opentelemetry/api';
import type { Server, UnifiedServerConfig } from './types';
import type {
	AgentConfig,
	AgentContext,
	AgentHandler,
	AgentWelcome,
} from '../types';
import type { Logger } from '../logger';
import type { ServerRoute } from './types';
import { createRouter } from '../router';
import KeyValueAPI from '../apis/keyvalue';
import VectorAPI from '../apis/vector';

/**
 * Creates a unified server based on the runtime environment
 *
 * @param config - The server configuration
 * @returns A promise that resolves to a server instance
 */
async function createUnifiedServer(
	config: UnifiedServerConfig
): Promise<Server> {
	if (process.env.AGENTUITY_BUNDLER_RUNTIME === 'bunjs') {
		const server = await import('./bun');
		return new server.BunServer(config);
	}
	const server = await import('./node');
	return new server.NodeServer(config);
}

/**
 * Creates a server route from a module file
 *
 * @param filename - The path to the module file
 * @param path - The URL path for the route
 * @param context - The agent context
 * @param port - The port the server is running on
 * @returns A promise that resolves to a server route
 * @throws Error if no handler is found in the module
 */
async function createRoute(
	filename: string,
	path: string,
	context: AgentContext,
	agent: AgentConfig,
	port: number
): Promise<ServerRoute> {
	const mod = await import(filename);
	let thehandler: AgentHandler | undefined;
	let thewelcome: AgentWelcome | undefined;
	if (mod.default) {
		thehandler = mod.default;
	} else {
		for (const key in mod) {
			if (key !== 'default' && mod[key] instanceof Function) {
				thehandler = mod[key];
				break;
			}
		}
	}
	for (const key in mod) {
		if (key === 'welcome' && mod[key] instanceof Function) {
			thewelcome = mod[key];
			break;
		}
	}
	if (!thehandler) {
		throw new Error(`No handler found in ${filename}`);
	}
	const handler = createRouter({
		context: { ...context, agent } as AgentContext,
		handler: thehandler,
		port,
	});
	return {
		agent,
		handler,
		welcome: thewelcome,
		method: 'POST',
		path,
	};
}

/**
 * Configuration for creating a server
 */
interface ServerConfig {
	context: AgentContext;
	directory: string;
	port: number;
	logger: Logger;
}

/**
 * Creates a server with routes from agent modules in a directory
 *
 * @param config - The server configuration
 * @returns A promise that resolves to a server instance
 * @throws Error if no routes are found in the directory
 */
export async function createServer({
	context,
	directory,
	port,
	logger,
}: ServerConfig) {
	const routes: ServerRoute[] = [];
	for (const agent of context.agents) {
		const filepath = join(directory, agent.filename);
		if (existsSync(filepath)) {
			const route = await createRoute(
				filepath,
				`/${agent.id}`,
				context,
				agent,
				port
			);
			routes.push(route);
			logger.info('registered %s at /%s', agent.name, agent.id);
		} else {
			throw new Error(`${filepath} does not exist for agent ${agent.name}`);
		}
	}
	if (routes.length === 0) {
		throw new Error(`No routes found in ${directory}`);
	}
	return createUnifiedServer({
		logger,
		port,
		routes,
		sdkVersion: context.sdkVersion,
	});
}

/**
 * Request parameters for creating a server context
 */
interface ServerContextRequest {
	tracer: Tracer;
	meter: Meter;
	logger: Logger;
	orgId?: string;
	projectId?: string;
	deploymentId?: string;
	runId?: string;
	devmode?: boolean;
	sdkVersion: string;
	agents: AgentConfig[];
}

const kv = new KeyValueAPI();
const vector = new VectorAPI();

/**
 * Creates an agent context for server operations
 *
 * @param req - The server context request parameters
 * @returns An agent context object
 */
export function createServerContext(req: ServerContextRequest): AgentContext {
	return {
		devmode: req.devmode,
		runId: req.runId,
		deploymentId: req.deploymentId,
		projectId: req.projectId,
		orgId: req.orgId,
		logger: req.logger,
		tracer: req.tracer,
		meter: req.meter,
		kv,
		vector,
		sdkVersion: req.sdkVersion,
		agents: req.agents,
		scope: 'local',
	} as unknown as AgentContext;
}
