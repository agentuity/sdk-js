import { AsyncLocalStorage } from 'node:async_hooks';
import type { AgentContext, AgentRequest, AgentResponse } from '../types';

/**
 * Provides the trio of parameters (request, response, context) that are passed to an agent handler.
 * Uses AsyncLocalStorage for thread-safe per-request scoping.
 */
export class HandlerParameterProvider {
	private static asyncLocalStorage =
		new AsyncLocalStorage<HandlerParameterProvider>();

	public request: AgentRequest;
	public response: AgentResponse;
	public context: AgentContext;

	private constructor(
		request: AgentRequest,
		response: AgentResponse,
		context: AgentContext
	) {
		this.request = request;
		this.response = response;
		this.context = context;
	}

	/**
	 * Run a function with scoped handler parameters for the current request
	 */
	public static run<T>(
		request: AgentRequest,
		response: AgentResponse,
		context: AgentContext,
		fn: () => T
	): T {
		const provider = new HandlerParameterProvider(request, response, context);
		return HandlerParameterProvider.asyncLocalStorage.run(provider, fn);
	}

	/**
	 * Get the current request's provider from AsyncLocalStorage
	 */
	public static getInstance(): HandlerParameterProvider {
		const provider = HandlerParameterProvider.asyncLocalStorage.getStore();
		if (!provider) {
			throw new Error(
				'HandlerParameterProvider not initialized for this request context'
			);
		}
		return provider;
	}
}
