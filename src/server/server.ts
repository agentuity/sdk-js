import type { Server, UnifiedServerConfig } from './types';
import type { AgentContext, AgentHandler } from '../types';
import type { Logger } from '../logger';
import type { ServerRoute } from './types';
import type { Tracer } from '@opentelemetry/api';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { createRouter } from '../router';
import { join } from 'node:path';
import KeyValueAPI from '../apis/keyvalue';
import VectorAPI from '../apis/vector';

async function createUnifiedServer(
	config: UnifiedServerConfig
): Promise<Server> {
	if (process.isBun) {
		const server = await import('./bun');
		return new server.BunServer(config);
	}
	const server = await import('./node');
	return new server.NodeServer(config);
}

async function createRoute(
	logger: Logger,
	filename: string,
	path: string,
	context: AgentContext
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
		context: { ...context, agent: mod.config },
	});
	logger.info('registering %s for %s', mod.config.name, path);
	return {
		path,
		method: 'POST',
		handler,
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
	for (const item of items) {
		const filepath = join(directory, item);
		if (statSync(filepath).isDirectory()) {
			const index = join(filepath, 'index.js');
			if (existsSync(index)) {
				routes.push(await createRoute(logger, index, `/${item}`, context));
			}
		}
	}
	if (routes.length === 0) {
		throw new Error(`No routes found in ${directory}`);
	}
	if (routes.length === 1) {
		const defaultRoute = { ...routes[0], path: '/' };
		routes.push(defaultRoute);
		logger.info('registering default route at /');
	}
	return createUnifiedServer({
		logger,
		port,
		routes,
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
	} as AgentContext;
}
