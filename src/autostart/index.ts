import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createServer, createServerContext } from '../server';
import { registerOtel } from '../otel';

/**
 * Configuration for auto-starting the Agentuity SDK
 */
interface AutostartConfig {
	basedir: string;
	distdir?: string;
	orgId?: string;
	projectId?: string;
	deploymentId?: string;
	runId?: string;
	port?: number;
	devmode?: boolean;
	environment?: string;
	cliVersion?: string;
	otlp?: {
		url?: string;
		bearerToken?: string;
	};
}

/**
 * Runs the Agentuity SDK with the specified configuration
 *
 * @param config - The configuration for auto-starting the SDK
 * @throws Error if the project directory does not exist or if projectId is not provided
 */
export async function run(config: AutostartConfig) {
	const { basedir, distdir, port = 3000 } = config;
	let directory = distdir;
	if (!directory) {
		const insideDist = join(basedir, 'src/agents');
		if (existsSync(insideDist)) {
			directory = insideDist;
		} else {
			directory = join(basedir, 'dist/src/agents');
		}
	}
	if (!existsSync(directory)) {
		throw new Error(`${directory} does not exist`);
	}
	if (process.env.AGENTUITY_ENVIRONMENT !== 'production' && !config.projectId) {
		// this path only works in local dev mode
		const yml = join(basedir, '..', 'agentuity.yaml');
		if (existsSync(yml)) {
			const ymlData = readFileSync(yml, 'utf8').toString();
			const match = ymlData.match(/project_id: (\w+)/);
			if (match?.length) {
				config.projectId = match[1];
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
		orgId: config.orgId,
		projectId: config.projectId,
		deploymentId: config.deploymentId,
		runId: config.runId,
		bearerToken: config?.otlp?.bearerToken,
		url: config?.otlp?.url,
		environment: config.devmode ? 'development' : config.environment,
	});
	const server = await createServer({
		context: createServerContext({
			devmode: config.devmode,
			runId: config.runId,
			deploymentId: config.deploymentId,
			projectId: config.projectId,
			orgId: config.orgId,
			logger: otel.logger,
			tracer: otel.tracer,
			sdkVersion,
		}),
		directory,
		port,
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
