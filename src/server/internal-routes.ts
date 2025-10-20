import type { Logger } from '../logger';
import type { ServerRequest } from './types';

/**
 * Handles internal /_agentuity routes
 * These routes are used internally by the SDK and should not be exposed to users
 */
export class InternalRoutesHandler {
	constructor(_logger: Logger) {
		// Logger parameter kept for future use
	}

	/**
	 * Checks if a request is for an internal route
	 */
	isInternalRoute(url: string): boolean {
		return url.startsWith('/_agentuity/');
	}

	/**
	 * Routes internal requests to appropriate handlers
	 */
	async handleInternalRoute(req: ServerRequest): Promise<Response | null> {
		if (!this.isInternalRoute(req.url)) {
			return null;
		}

		// Add more internal routes here as needed
		// e.g., /_agentuity/analytics, /_agentuity/metrics, etc.

		return new Response('Internal route not found', { status: 404 });
	}
}
