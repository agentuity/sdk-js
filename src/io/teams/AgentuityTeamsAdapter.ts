import {
	CloudAdapter,
	ConfigurationBotFrameworkAuthentication,
} from 'botbuilder';
import { HandlerParameterProvider } from '../../server/handlerParameterProvider';
// Standalone AgentuityAdapter - no imports that could cause TypeScript issues
import type { AgentContext, AgentRequest, AgentResponse } from '../../types';
import type {
	AgentuityTeamsActivityHandler,
	AgentuityTeamsActivityHandlerConstructor,
} from './AgentuityTeamsActivityHandler';

export class AgentuityTeamsAdapter {
	private adapter: CloudAdapter;
	bot: AgentuityTeamsActivityHandler;
	req: AgentRequest;
	resp: AgentResponse;
	ctx: AgentContext;

	constructor(botClass: AgentuityTeamsActivityHandlerConstructor) {
		const auth = new ConfigurationBotFrameworkAuthentication(
			process.env as unknown as Record<string, string>
		);
		const provider = HandlerParameterProvider.getInstance();

		this.adapter = new CloudAdapter(auth);
		this.ctx = provider.context;
		this.req = provider.request;
		this.resp = provider.response;
		this.bot = new botClass(this.req, this.resp, this.ctx);
	}

	async process() {
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
					const res = await this.bot.run(context);
					return res;
				}
			);
			return this.resp.json({
				status: 200,
				body: 'OK',
				message: 'Teams webhook processed successfully',
			});
		} catch (error) {
			console.error('Error processing Teams webhook:', error);
			return this.resp.json({
				status: 500,
				body: `Error: ${error instanceof Error ? error.message : String(error)}`,
				message: 'Failed to process Teams webhook',
			});
		}
	}
}
