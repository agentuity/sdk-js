import { TeamsActivityHandler } from 'botbuilder';
import type { AgentContext, AgentRequest, AgentResponse } from '../../types';

export type AgentuityTeamsActivityHandlerConstructor = new (
	req: AgentRequest,
	resp: AgentResponse,
	ctx: AgentContext
) => AgentuityTeamsActivityHandler;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const checkPrototypeChain = (prototype: any): boolean => {
	let current = prototype;
	while (current) {
		if (current.constructor?.name === 'AgentuityTeamsActivityHandler') {
			return true;
		}
		current = Object.getPrototypeOf(current);
	}
	return false;
};

export const isAgentuityTeamsActivityHandlerConstructor = (
	value: unknown
): value is AgentuityTeamsActivityHandlerConstructor => {
	const isFunction = typeof value === 'function';
	const hasPrototype = isFunction && value.prototype;
	const isInstance = hasPrototype && checkPrototypeChain(value.prototype);
	return isFunction && hasPrototype && isInstance;
};

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
