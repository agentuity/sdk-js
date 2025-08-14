import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Meter, Tracer } from '@opentelemetry/api';
import DiscordAPI from '../apis/discord';
import EmailAPI from '../apis/email';
import KeyValueAPI from '../apis/keyvalue';
import ObjectStoreAPI from '../apis/objectstore';
import VectorAPI from '../apis/vector';
import type { Logger } from '../logger';
import { createRouter } from '../router';
import type {
	AgentConfig,
	AgentContext,
	AgentHandler,
	AgentWelcome,
} from '../types';
import type { Server, UnifiedServerConfig } from './types';
import type { ServerRoute } from './types';

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
	console.log('createRoute inside');
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	let mod: any;
	try {
		mod = await import(filename);
	} catch (error) {
		console.error('Error importing module', error);
		throw new Error(`Error importing module ${filename}: ${error}`);
	}

	console.log('mod 0');
	let thehandler: AgentHandler | undefined;
	console.log('thehandler');
	let thewelcome: AgentWelcome | undefined;
	console.log('thewelcome');
	console.log('mod 1');
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
	console.log('mod 2');
	for (const key in mod) {
		if (key === 'welcome' && mod[key] instanceof Function) {
			thewelcome = mod[key];
			break;
		}
	}
	console.log('key');
	if (!thehandler) {
		throw new Error(`No handler found in ${filename}`);
	}
	console.log('thehandler');
	const handler = createRouter({
		context: { ...context, agent } as AgentContext,
		handler: thehandler,
		port,
	});
	console.log('createRoute after handler');
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
	console.log('createServer');
	const routes: ServerRoute[] = [];
	for (const agent of context.agents) {
		const filepath = join(directory, agent.filename);
		if (existsSync(filepath)) {
			console.log('before createRoute');
			console.log('filepath', filepath);
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
	console.log('createUnifiedServer');
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
const email = new EmailAPI();
const discord = new DiscordAPI();
const objectstore = new ObjectStoreAPI();

/**
 * Creates an agent context for server operations
 *
 * @param req - The server context request parameters
 * @returns An agent context object
 */
export function createServerContext(req: ServerContextRequest): AgentContext {
	console.log('createServerContext');
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
		email,
		discord,
		objectstore,
		sdkVersion: req.sdkVersion,
		agents: req.agents,
		scope: 'local',
	} as unknown as AgentContext;
}
