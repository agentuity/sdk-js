import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { createServer, createServerContext } from '../server';
import { registerOtel } from '../otel';

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
	otlp?: {
		url?: string;
		bearerToken?: string;
	};
}

export async function run(config: AutostartConfig) {
	const { basedir, distdir, port = 3000 } = config;
	const pkg = join(basedir, 'package.json');
	if (!existsSync(pkg)) {
		throw new Error(`${pkg} does not exist`);
	}
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
	const { name, version } = JSON.parse(readFileSync(pkg, 'utf8'));
	const otel = registerOtel({
		name,
		version,
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
