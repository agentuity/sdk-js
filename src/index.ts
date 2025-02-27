export * from './server';
export * from './logger';
export * from './types';

import { run } from './autostart';

/**
 * Runs the Agentuity SDK with the specified configuration
 *
 * @param autoStart - Whether to automatically start the SDK
 * @param dir - The directory where the SDK is located
 * @returns A Promise that resolves when the SDK has been run
 */
export async function runner(
	autoStart = false,
	dir = process.env.AGENTUITY_SDK_DIR
) {
	if (autoStart && !!dir) {
		await run({
			basedir: dir,
			distdir: process.env.AGENTUITY_SDK_DIST_DIR,
			orgId: process.env.AGENTUITY_CLOUD_ORG_ID,
			projectId: process.env.AGENTUITY_CLOUD_PROJECT_ID,
			deploymentId: process.env.AGENTUITY_CLOUD_DEPLOYMENT_ID,
			runId: process.env.AGENTUITY_CLOUD_RUN_ID,
			port: parseInt(process.env.PORT ?? '3000'),
			devmode: process.env.AGENTUITY_SDK_DEV_MODE === 'true',
			cliVersion: process.env.AGENTUITY_CLI_VERSION,
			environment:
				process.env.AGENTUITY_ENVIRONMENT ??
				process.env.NODE_ENV ??
				'development',
			otlp: {
				url: process.env.AGENTUITY_OTLP_URL,
				bearerToken: process.env.AGENTUITY_OTLP_BEARER_TOKEN,
			},
		});
	}
}
