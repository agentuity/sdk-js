import type { AgentContext, AgentRequest, AgentResponse } from '../types';

/**
 * Provides the trio of parameters (request, response, context) that are passed to an agent handler.
 * Implemented as a singleton to centralize construction logic.
 */
export class HandlerParameterProvider {
	private static instance: HandlerParameterProvider | undefined;
	public request: AgentRequest;
	public response: AgentResponse;
	public context: AgentContext;

	constructor(
		request: AgentRequest,
		response: AgentResponse,
		context: AgentContext
	) {
		this.request = request;
		this.response = response;
		this.context = context;
		HandlerParameterProvider.instance = this;
	}

	/**
	 * Get the single instance of the provider
	 */
	public static getInstance(): HandlerParameterProvider {
		if (!HandlerParameterProvider.instance) {
			throw new Error('HandlerParameterProvider not initialized');
		}
		return HandlerParameterProvider.instance;
	}
}
