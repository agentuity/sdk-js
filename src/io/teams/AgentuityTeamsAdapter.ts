import {
	CloudAdapter,
	ConfigurationBotFrameworkAuthentication,
} from 'botbuilder';
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

	constructor(
		req: AgentRequest,
		resp: AgentResponse,
		agentuityCtx: AgentContext,
		botClass: AgentuityTeamsActivityHandlerConstructor
	) {
		const auth = new ConfigurationBotFrameworkAuthentication(
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			process.env as any
		);

		this.adapter = new CloudAdapter(auth);
		this.bot = new botClass(req, resp, agentuityCtx);
		this.ctx = agentuityCtx;
		this.req = req;
		this.resp = resp;
	}

	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
	async process(): Promise<any> {
		try {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			this.ctx.logger.debug('process');
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const teamsPayload = (await this.req.data.json()) as any;
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const mockRestifyReq: any = {
				method: 'POST',
				body: teamsPayload,
				headers: this.req.metadata.headers,
			};

			this.ctx.logger.info('Mock request created:', mockRestifyReq);

			let responseStatus = 200;
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			let responseBody: any = null;
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const mockRestifyRes: any = {
				status: (code: number) => {
					responseStatus = code;
					return {
						// biome-ignore lint/suspicious/noExplicitAny: <explanation>
						send: (body: any) => {
							responseBody = body;
						},
					};
				},
				end: () => {},
				header: () => {},
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
				send: (body?: any) => {
					responseBody = body;
				},
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
			this.ctx.logger.info(
				'adapter.process completed with status',
				responseStatus
			);

			return this.resp.json({
				status: responseStatus,
				body: responseBody,
				message: 'Teams webhook processed successfully through CloudAdapter',
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
