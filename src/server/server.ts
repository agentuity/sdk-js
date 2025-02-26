import { join } from 'node:path';
import { readdirSync, existsSync, statSync } from 'node:fs';
import type { Tracer } from '@opentelemetry/api';
import type { Server, ServerAgent, UnifiedServerConfig } from './types';
import type { AgentContext, AgentHandler } from '../types';
import type { Logger } from '../logger';
import type { ServerRoute } from './types';
import { createRouter, getAgentId } from '../router';
import KeyValueAPI from '../apis/keyvalue';
import VectorAPI from '../apis/vector';

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

async function createRoute(
	filename: string,
	path: string,
	context: AgentContext,
	agents: ServerAgent[],
	port: number
): Promise<ServerRoute> {
	const mod = await import(filename);
	let thehandler: AgentHandler | undefined;
	if (mod.default) {
		thehandler = mod.default;
	} else if (mod.config) {
		for (const key in mod) {
			if (key !== 'default' && mod[key] instanceof Function) {
				thehandler = mod[key];
				break;
			}
		}
	}
	if (!thehandler) {
		throw new Error(`No handler found in ${filename}`);
	}
	const handler = createRouter({
		handler: thehandler,
		context: { ...context, agent: mod.config, agents } as AgentContext,
		port,
	});
	const agentId = await getAgentId(context.projectId, mod.config.name);
	return {
		path,
		method: 'POST',
		handler,
		agent: {
			id: agentId,
			path: path.substring(1),
			name: mod.config.name,
			description: mod.config.description,
		},
	};
}

interface ServerConfig {
	context: AgentContext;
	directory: string;
	port: number;
	logger: Logger;
}

export async function createServer({
	context,
	directory,
	port,
	logger,
}: ServerConfig) {
	const items = readdirSync(directory);
	const routes: ServerRoute[] = [];
	const agents: ServerAgent[] = [];
	for (const item of items) {
		const filepath = join(directory, item);
		if (statSync(filepath).isDirectory()) {
			const index = join(filepath, 'index.js');
			if (existsSync(index)) {
				const route = await createRoute(
					index,
					`/${item}`,
					context,
					agents,
					port
				);
				agents.push(route.agent);
				routes.push(route);
				// create another route by id
				routes.push({
					...route,
					path: `/${route.agent.id}`,
				});
				logger.info('registering %s at %s', route.agent.name, route.path);
				logger.info('registering %s at /%s', route.agent.name, route.agent.id);
			}
		}
	}
	if (routes.length === 0) {
		throw new Error(`No routes found in ${directory}`);
	}
	if (routes.length === 2) {
		// TODO: need to find the default route
		const defaultRoute = { ...routes[0], path: '/' };
		routes.push(defaultRoute);
		logger.info('registering default route at /');
	}
	return createUnifiedServer({
		logger,
		port,
		routes,
		sdkVersion: context.sdkVersion,
	});
}

interface ServerContextRequest {
	tracer: Tracer;
	logger: Logger;
	orgId?: string;
	projectId?: string;
	deploymentId?: string;
	runId?: string;
	devmode?: boolean;
	sdkVersion: string;
}

const kv = new KeyValueAPI();
const vector = new VectorAPI();

export function createServerContext(req: ServerContextRequest): AgentContext {
	return {
		devmode: req.devmode,
		runId: req.runId,
		deploymentId: req.deploymentId,
		projectId: req.projectId,
		orgId: req.orgId,
		logger: req.logger,
		tracer: req.tracer,
		kv,
		vector,
		sdkVersion: req.sdkVersion,
	} as AgentContext;
}
