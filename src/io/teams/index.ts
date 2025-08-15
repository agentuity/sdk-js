import { inspect } from 'node:util';
import type { Activity } from 'botbuilder';
import { HandlerParameterProvider } from '../../server/handlerParameterProvider';
import type { AgentResponseData } from '../../types';
import type { AgentuityTeamsActivityHandlerConstructor } from './AgentuityTeamsActivityHandler';
import { AgentuityTeamsAdapter } from './AgentuityTeamsAdapter';
import { SimpleAgentuityTeamsBot } from './SimpleAgentuityTeamsBot';

export class TeamsCustomBot {
	adapter: AgentuityTeamsAdapter;
	constructor(
		private payload: Activity,
		botClass: AgentuityTeamsActivityHandlerConstructor
	) {
		this.payload = payload;
		this.adapter = new AgentuityTeamsAdapter(undefined, botClass);
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
	constructor(payload: Activity) {
		this.payload = payload;
	}

	[inspect.custom]() {
		return this.toString();
	}

	toString() {
		return JSON.stringify(this.payload);
	}

	async message(): Promise<string> {
		return Promise.resolve(this.payload.text);
	}

	async activity(): Promise<Activity> {
		return Promise.resolve(this.payload);
	}

	async sendReply(message: string): Promise<void> {
		const adapter = new AgentuityTeamsAdapter(
			new SimpleAgentuityTeamsBot(message)
		);
		await adapter.process();
	}
}

export async function parseTeams(data: Buffer): Promise<Teams> {
	try {
		const payload = JSON.parse(data.toString());

		return new Teams(payload);
	} catch (error) {
		throw new Error(
			`Failed to parse teams: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

export async function parseTeamsCustomBot(
	data: Buffer,
	botClass: AgentuityTeamsActivityHandlerConstructor
): Promise<TeamsCustomBot> {
	try {
		const payload = JSON.parse(data.toString());
		const teamsCustomBot = new TeamsCustomBot(payload, botClass);
		await teamsCustomBot.adapter.process();
		return teamsCustomBot;
	} catch (error) {
		throw new Error(
			`Failed to parse teams: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}
