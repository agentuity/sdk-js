import type { Server, UnifiedServerConfig } from "./types";
import type { AgentContext } from "../types";
import type { Logger } from "../logger";
import type { ServerRoute } from "./types";
import type { Tracer } from "@opentelemetry/api";
import { readdirSync, existsSync } from "node:fs";
import { createRouter } from "../router";
import { join } from "node:path";
import KeyValueAPI from "../apis/keyvalue";
import VectorAPI from "../apis/vector";

async function createUnifiedServer(
	config: UnifiedServerConfig,
): Promise<Server> {
	if (process.isBun) {
		const server = await import("./bun");
		return new server.BunServer(config);
	}
	const server = await import("./node");
	return new server.NodeServer(config);
}

async function createRoute(
	filename: string,
	path: string,
	context: AgentContext,
): Promise<ServerRoute> {
	const mod = await import(filename);
	const handler = createRouter({
		handler: mod.default,
		context: { ...context, agent: mod.config },
	});
	return {
		path,
		method: "POST",
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
	if (existsSync(join(directory, "index.js"))) {
		const filename = join(directory, "index.js");
		routes.push(await createRoute(filename, "/", context));
	} else {
		for (const item of items) {
			if (item.endsWith(".js")) {
				const filename = join(directory, item);
				routes.push(await createRoute(filename, `/${item}`, context));
			}
		}
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
		devmode: process.env.AGENTUITY_SDK_DEV_MODE === "true",
		runId: "",
		deploymentId: process.env.AGENTUITY_CLOUD_DEPLOYMENT_ID,
		projectId: process.env.AGENTUITY_CLOUD_PROJECT_ID,
		orgId: process.env.AGENTUITY_CLOUD_ORG_ID,
		logger: req.logger,
		tracer: req.tracer,
		kv,
		vector,
	} as AgentContext;
}
