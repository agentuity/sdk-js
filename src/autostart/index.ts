import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createServer, createServerContext } from '../server';
import { registerOtel } from '../otel';
import type { AgentConfig } from '../types';

/**
 * Configuration for auto-starting the Agentuity SDK
 */
interface AutostartConfig {
	basedir: string;
	distdir?: string;
	orgId?: string;
	projectId?: string;
	deploymentId?: string;
	port?: number;
	devmode?: boolean;
	environment?: string;
	cliVersion?: string;
	otlp?: {
		url?: string;
		bearerToken?: string;
	};
	agents: AgentConfig[];
}

/**
 * Runs the Agentuity SDK with the specified configuration
 *
 * @param config - The configuration for auto-starting the SDK
 * @throws Error if the project directory does not exist or if projectId is not provided
 */
export async function run(config: AutostartConfig) {
	let { port } = config;
	const { basedir } = config;
	if (process.env.AGENTUITY_ENVIRONMENT !== 'production') {
		// this path only works in local dev mode
		const yml = join(basedir, '..', 'agentuity.yaml');
		if (existsSync(yml)) {
			const ymlData = readFileSync(yml, 'utf8').toString();
			const match = ymlData.match(/project_id: (\w+)/);
			if (match?.length) {
				config.projectId = match[1];
			}
			if (!port) {
				const match = ymlData.match(/port: (\d+)/);
				if (match?.length) {
					port = Number.parseInt(match[1]);
				}
			}
		}
	}
	if (!config.projectId) {
		throw new Error(
			'projectId is required and not found either in agentuity.yaml or in the environment'
		);
	}
	const name = process.env.AGENTUITY_SDK_APP_NAME ?? 'unknown';
	const version = process.env.AGENTUITY_SDK_APP_VERSION ?? 'unknown';
	const sdkVersion = process.env.AGENTUITY_SDK_VERSION ?? 'unknown';
	const otel = registerOtel({
		name,
		version,
		sdkVersion,
		cliVersion: config.cliVersion,
		devmode: config.devmode,
		orgId: config.orgId,
		projectId: config.projectId,
		deploymentId: config.deploymentId,
		bearerToken: config?.otlp?.bearerToken,
		url: config?.otlp?.url,
		environment: config.devmode ? 'development' : config.environment,
	});
	const server = await createServer({
		context: createServerContext({
			devmode: config.devmode,
			deploymentId: config.deploymentId,
			projectId: config.projectId,
			orgId: config.orgId,
			logger: otel.logger,
			tracer: otel.tracer,
			sdkVersion,
			agents: config.agents,
		}),
		directory: basedir,
		port: port ?? 3500,
		logger: otel.logger,
	});
	await server.start();
	const shutdown = async () => {
		await server.stop();
		await otel.shutdown();
	};
	process.on('beforeExit', shutdown);
	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);
	process.on('SIGQUIT', shutdown);
}
