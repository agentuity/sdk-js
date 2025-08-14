import { TeamsActivityHandler } from 'botbuilder';
import type { AgentContext, AgentRequest, AgentResponse } from '../../types';

export type AgentuityTeamsActivityHandlerConstructor = new (
	req: AgentRequest,
	resp: AgentResponse,
	ctx: AgentContext
) => AgentuityTeamsActivityHandler;

export abstract class AgentuityTeamsActivityHandler extends TeamsActivityHandler {
	ctx: AgentContext;
	req: AgentRequest;
	resp: AgentResponse;

	constructor(req: AgentRequest, resp: AgentResponse, ctx: AgentContext) {
		super();
		this.ctx = ctx;
		this.req = req;
		this.resp = resp;
	}
}
