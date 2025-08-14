import { inspect } from 'node:util';
import type { TeamsActivityHandler } from 'botbuilder';
import { HandlerParameterProvider } from '../../server/handlerParameterProvider';
import type { AgentResponseData } from '../../types';
import type { AgentuityTeamsActivityHandlerConstructor } from './AgentuityTeamsActivityHandler';
import { AgentuityTeamsAdapter } from './AgentuityTeamsAdapter';

export class Teams {
	bot: TeamsActivityHandler;
	adapter: AgentuityTeamsAdapter;
	constructor(
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		private readonly payload: any,
		botClass: AgentuityTeamsActivityHandlerConstructor
	) {
		this.adapter = new AgentuityTeamsAdapter(botClass);
		this.bot = this.adapter.bot;
		this.adapter.process();
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

export async function parseTeams(
	data: Buffer,
	botClass: AgentuityTeamsActivityHandlerConstructor
): Promise<Teams> {
	try {
		const payload = JSON.parse(data.toString());

		return new Teams(payload, botClass);
	} catch (error) {
		throw new Error(
			`Failed to parse teams: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}
