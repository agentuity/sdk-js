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
	bot: SimpleAgentuityTeamsBot | AgentuityTeamsActivityHandler;
	mode: 'dev' | 'cloud';

	constructor(
		config: Record<string, string>,
		mode: 'dev' | 'cloud',
		bot?: SimpleAgentuityTeamsBot,
		botClass?: AgentuityTeamsActivityHandlerConstructor | ActivityHandler
	) {
		// Configure credentials based on mode
		let appId: string;
		let appPassword: string;
		let tenantId: string;
		let appType: string;

		if (mode === 'cloud') {
			appId = config.MicrosoftAppId || process.env.MicrosoftAppId || '';
			appPassword =
				config.MicrosoftAppPassword || process.env.MicrosoftAppPassword || '';
			tenantId =
				config.MicrosoftAppTenantId || process.env.MicrosoftAppTenantId || '';
			appType = config.MicrosoftAppType || process.env.MicrosoftAppType || '';
		} else {
			// Dev mode fallback to hardcoded values
			appId = process.env.MicrosoftAppId || '';
			appPassword = process.env.MicrosoftAppPassword || '';
			tenantId = process.env.MicrosoftAppTenantId || '';
			appType = process.env.MicrosoftAppType || '';
		}

		if (!appId || !appPassword || !tenantId || !appType) {
			throw new Error(
				`Missing required Teams auth credentials. AppId: ${!!appId}, AppPassword: ${!!appPassword}, TenantId: ${!!tenantId}, AppType: ${!!appType}`
			);
		}

		const auth = new ConfigurationBotFrameworkAuthentication({
			MicrosoftAppId: appId,
			MicrosoftAppTenantId: tenantId,
			MicrosoftAppPassword: appPassword,
			MicrosoftAppType: appType,
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		} as any);
		const provider = HandlerParameterProvider.getInstance();
		this.adapter = new CloudAdapter(auth);
		this.ctx = provider.context;
		this.req = provider.request;
		this.res = provider.response;
		this.mode = mode;
		if (botClass && isAgentuityTeamsActivityHandlerConstructor(botClass)) {
			this.bot = new botClass(this.req, this.res, this.ctx);
		} else if (botClass) {
			throw new Error(
				'Invalid custom bot class must extend AgentuityTeamsActivityHandler'
			);
		} else if (bot instanceof SimpleAgentuityTeamsBot) {
			this.bot = bot;
		} else {
			throw new Error('Invalid bot config');
		}
	}

	async process() {
		try {
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const teamsPayload = (await this.req.data.json()) as any;
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			const mockRestifyReq: any = {
				method: 'POST',
				body: teamsPayload,
				headers:
					this.mode === 'cloud'
						? this.req.metadata.metadata
						: this.req.metadata.headers,
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
		} catch (error) {
			console.error('Error processing Teams webhook:', error);
		}
	}
}
