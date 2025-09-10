import { inspect } from 'node:util';
import type { Activity } from 'botbuilder';
import { HandlerParameterProvider } from '../../server/handlerParameterProvider';
import type { AgentResponseData, JsonObject } from '../../types';
import type { AgentuityTeamsActivityHandlerConstructor } from './AgentuityTeamsActivityHandler';
import { AgentuityTeamsAdapter } from './AgentuityTeamsAdapter';
import { SimpleAgentuityTeamsBot } from './SimpleAgentuityTeamsBot';

type Mode = 'dev' | 'cloud';
type parseConfigResult = {
	config: Record<string, string>;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	justPayload: Record<string, any>;
	mode: Mode;
};

const parseConfig = (
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	payload: any,
	metadata: JsonObject
): parseConfigResult => {
	const keys = Object.keys(metadata);
	let config: Record<string, string>;
	let mode: Mode;
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	let justPayload: Record<string, any>;

	if (
		keys.includes('MicrosoftAppId') &&
		keys.includes('MicrosoftAppPassword') &&
		keys.includes('MicrosoftAppTenantId') &&
		keys.includes('MicrosoftAppType')
	) {
		// this is how prod mode works
		config = {
			MicrosoftAppId: metadata.MicrosoftAppId as string,
			MicrosoftAppPassword: metadata.MicrosoftAppPassword as string,
			MicrosoftAppTenantId: metadata.MicrosoftAppTenantId as string,
			MicrosoftAppType: metadata.MicrosoftAppType as string,
		};
		if (!payload) {
			throw new Error('Cloud mode requires payload to be defined');
		}
		justPayload = payload;
		mode = 'cloud';
	} else {
		// makes dev mode work
		config = {
			MicrosoftAppId: process.env.MicrosoftAppId as string,
			MicrosoftAppPassword: process.env.MicrosoftAppPassword as string,
			MicrosoftAppTenantId: process.env.MicrosoftAppTenantId as string,
			MicrosoftAppType: process.env.MicrosoftAppType as string,
		};
		if (!payload) {
			throw new Error('Dev mode requires payload to be defined');
		}
		justPayload = payload;
		mode = 'dev';
	}
	return { config, justPayload, mode };
};

export class TeamsCustomBot {
	adapter: AgentuityTeamsAdapter;
	config: Record<string, string>;
	constructor(
		private payload: Activity,
		botClass: AgentuityTeamsActivityHandlerConstructor,
		config: Record<string, string>,
		mode: Mode
	) {
		this.payload = payload;
		this.config = config;
		this.adapter = new AgentuityTeamsAdapter(config, mode, undefined, botClass);
	}

	[inspect.custom]() {
		return this.toString();
	}

	toString() {
		return JSON.stringify(this.payload);
	}

	async res(): Promise<AgentResponseData> {
		const provider = HandlerParameterProvider.getInstance();
		return provider.response.json({
			message: 'Message was processed by Teams bot',
		});
	}
}

export class Teams {
	private payload: Activity;
	private config: Record<string, string>;
	private mode: Mode;
	constructor(payload: Activity, config: Record<string, string>, mode: Mode) {
		this.payload = payload;
		this.config = config;
		this.mode = mode;
	}

	[inspect.custom]() {
		return this.toString();
	}

	toString() {
		return JSON.stringify(this.payload);
	}

	async message(): Promise<string> {
		if (!this.payload) {
			throw new Error('Teams payload is undefined');
		}
		return Promise.resolve(this.payload.text || '');
	}

	async activity(): Promise<Activity> {
		return Promise.resolve(this.payload);
	}

	async sendReply(message: string): Promise<void> {
		const adapter = new AgentuityTeamsAdapter(
			this.config,
			this.mode,
			new SimpleAgentuityTeamsBot(message),
			undefined
		);
		await adapter.process();
	}
}

export async function parseTeams(
	data: Buffer,
	metadata: JsonObject
): Promise<Teams> {
	try {
		const payload = JSON.parse(data.toString());
		const { config, justPayload, mode } = parseConfig(payload, metadata);
		return new Teams(justPayload as Activity, config, mode);
	} catch (error) {
		throw new Error(
			`Failed to parse teams: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

export async function parseTeamsCustomBot(
	data: Buffer,
	botClass: AgentuityTeamsActivityHandlerConstructor,
	metadata: JsonObject
): Promise<TeamsCustomBot> {
	try {
		const payload = JSON.parse(data.toString());
		const { config, justPayload, mode } = parseConfig(payload, metadata);
		const teamsCustomBot = new TeamsCustomBot(
			justPayload as Activity,
			botClass,
			config,
			mode
		);
		await teamsCustomBot.adapter.process();
		return teamsCustomBot;
	} catch (error) {
		throw new Error(
			`Failed to parse teams: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}
