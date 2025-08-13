import { inspect } from 'node:util';
import type { TeamsActivityHandler } from 'botbuilder';
import type { AgentuityTeamsAdapter } from './AgentuityTeamsAdapter';

export class Teams {
	bot: TeamsActivityHandler;
	adapter: AgentuityTeamsAdapter;
	constructor(
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		private readonly payload: any,
		adapter: AgentuityTeamsAdapter
	) {
		this.adapter = adapter;
		this.bot = adapter.bot;
	}

	[inspect.custom]() {
		return this.toString();
	}

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	async process(): Promise<any> {
		return this.adapter.process();
	}

	toString() {
		return JSON.stringify(this.payload);
	}
}

export async function parseTeams(
	data: Buffer,
	adapter: AgentuityTeamsAdapter
): Promise<Teams> {
	try {
		const payload = JSON.parse(data.toString());
		return new Teams(payload, adapter);
	} catch (error) {
		throw new Error(
			`Failed to parse teams: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}
