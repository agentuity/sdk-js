import {
	type ActivityHandler,
	CloudAdapter,
	ConfigurationBotFrameworkAuthentication,
} from 'botbuilder';
import { HandlerParameterProvider } from '../../server/handlerParameterProvider';
// Standalone AgentuityAdapter - no imports that could cause TypeScript issues
import type { AgentContext, AgentRequest, AgentResponse } from '../../types';
import {
	type AgentuityTeamsActivityHandler,
	type AgentuityTeamsActivityHandlerConstructor,
	isAgentuityTeamsActivityHandlerConstructor,
} from './AgentuityTeamsActivityHandler';
import { SimpleAgentuityTeamsBot } from './SimpleAgentuityTeamsBot';

export class AgentuityTeamsAdapter {
	private adapter: CloudAdapter;
	req: AgentRequest;
	res: AgentResponse;
	ctx: AgentContext;

	constructor(
		bot?: SimpleAgentuityTeamsBot,
		botClass?: AgentuityTeamsActivityHandlerConstructor | ActivityHandler
	) {
		const auth = new ConfigurationBotFrameworkAuthentication(
			process.env as unknown as Record<string, string>
		);
		const provider = HandlerParameterProvider.getInstance();
		this.adapter = new CloudAdapter(auth);
		this.ctx = provider.context;
		this.req = provider.request;
		this.res = provider.response;
		if (botClass && isAgentuityTeamsActivityHandlerConstructor(botClass)) {
			this.process(new botClass(this.req, this.res, this.ctx));
		} else if (botClass) {
			throw new Error(
				'Invalid custom bot class must extend AgentuityTeamsActivityHandler'
			);
		} else if (bot instanceof SimpleAgentuityTeamsBot) {
			this.process(bot);
		} else {
			throw new Error('Invalid bot class');
		}
	}

	async process(bot: AgentuityTeamsActivityHandler | ActivityHandler) {
		try {
			const teamsPayload = (await this.req.data.json()) as unknown;
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const mockRestifyReq: any = {
				method: 'POST',
				body: teamsPayload,
				headers: this.req.metadata.headers,
			};

			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const mockRestifyRes: any = {
				status: (code: number) => {
					return {
						send: (body: unknown) => {},
					};
				},
				end: () => {},
				header: () => {},
				send: (body?: unknown) => {},
			};

			await this.adapter.process(
				mockRestifyReq,
				mockRestifyRes,
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
				async (context: any) => {
					const res = await bot.run(context);
					return res;
				}
			);
		} catch (error) {
			console.error('Error processing Teams webhook:', error);
		}
	}
}
