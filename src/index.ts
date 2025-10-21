export * from './apis/eval';
export * from './logger';
export * from './server';
export * from './types';
export { hash, hashSync } from './utils/hash';
export * from './utils/interpolate';
export {
	type PromptAttributes,
	type PromptAttributesParams,
	processPromptMetadata,
} from './utils/promptMetadata';

import DiscordAPI from './apis/discord';
// Export APIs
import EmailAPI from './apis/email';
import EvalAPI from './apis/eval';
import EvalJobScheduler from './apis/evaljobscheduler';
import PatchPortal from './apis/patchportal';
import PromptAPI from './apis/prompt';
import StreamAPIImpl from './apis/stream';
export {
	EmailAPI,
	DiscordAPI,
	EvalAPI,
	EvalJobScheduler,
	PatchPortal,
	PromptAPI,
	StreamAPIImpl,
};

import { TeamsActivityHandler } from 'botbuilder';
import { run } from './autostart';
import { UnsupportedSlackPayload } from './io/slack';
import { AgentuityTeamsActivityHandler } from './io/teams/AgentuityTeamsActivityHandler';
import { AgentuityTeamsAdapter } from './io/teams/AgentuityTeamsAdapter';
import type { AgentConfig } from './types';

export {
	AgentuityTeamsAdapter,
	AgentuityTeamsActivityHandler,
	TeamsActivityHandler,
	UnsupportedSlackPayload,
};

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
		const agentsJSON = process.env.AGENTUITY_CLOUD_AGENTS_JSON;
		let agents: AgentConfig[] = [];
		if (agentsJSON) {
			agents = JSON.parse(agentsJSON);
		} else {
			console.warn(
				'[WARN] expected AGENTUITY_CLOUD_AGENTS_JSON to be set but it was not. will attempt to load manually.'
			);
		}
		await run({
			basedir: dir,
			orgId: process.env.AGENTUITY_CLOUD_ORG_ID,
			projectId: process.env.AGENTUITY_CLOUD_PROJECT_ID,
			deploymentId: process.env.AGENTUITY_CLOUD_DEPLOYMENT_ID,
			port: process.env.AGENTUITY_CLOUD_PORT
				? Number.parseInt(process.env.AGENTUITY_CLOUD_PORT)
				: process.env.PORT
					? Number.parseInt(process.env.PORT)
					: undefined,
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
			userOtelConf: process.env.AGENTUITY_USER_OTEL_CONF
				? JSON.parse(process.env.AGENTUITY_USER_OTEL_CONF)
				: undefined,
			agents,
		});
	}
}
