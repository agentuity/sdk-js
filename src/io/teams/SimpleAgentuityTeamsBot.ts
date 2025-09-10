import { TeamsActivityHandler, type TurnContext } from 'botbuilder';

export const isSimpleAgentuityTeamsBot = (
	value: unknown
): value is typeof SimpleAgentuityTeamsBot => {
	return (
		typeof value === 'function' &&
		value.prototype &&
		(value.prototype instanceof SimpleAgentuityTeamsBot ||
			value === SimpleAgentuityTeamsBot)
	);
};

export class SimpleAgentuityTeamsBot extends TeamsActivityHandler {
	private message: string;
	constructor(message: string) {
		super();
		this.message = message;
		this.onMessage(async (context, next) => {
			await this.reply(context);
			await next();
		});
	}
	async reply(context: TurnContext): Promise<void> {
		if (!this.message) {
			throw new Error('No outbound message provided');
		}
		await context.sendActivity(this.message);
	}
}
