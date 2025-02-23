import type { Server, UnifiedServerConfig } from './types';
import type { AgentContext, AgentHandler } from '../types';
import type { Logger } from '../logger';
import type { ServerRoute } from './types';
import type { Tracer } from '@opentelemetry/api';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { createRouter } from '../router';
import { dirname, join, basename } from 'node:path';
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
}

const kv = new KeyValueAPI();
const vector = new VectorAPI();

export function createServerContext(req: ServerContextRequest): AgentContext {
	return {
		devmode: process.env.AGENTUITY_SDK_DEV_MODE === 'true',
		runId: '',
		deploymentId: process.env.AGENTUITY_CLOUD_DEPLOYMENT_ID,
		projectId: process.env.AGENTUITY_CLOUD_PROJECT_ID,
		orgId: process.env.AGENTUITY_CLOUD_ORG_ID,
		logger: req.logger,
		tracer: req.tracer,
		kv,
		vector,
	} as AgentContext;
}
