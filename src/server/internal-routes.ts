import EvalAPI from '../apis/eval';
import type { Logger } from '../logger';
import type { ServerRequest } from './types';

/**
 * Handles internal /_agentuity routes
 * These routes are used internally by the SDK and should not be exposed to users
 */
export class InternalRoutesHandler {
	private logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	/**
	 * Handles internal eval routes: /_agentuity/eval/:evalId (POST)
	 */
	async handleEval(req: ServerRequest): Promise<Response> {
		if (req.method !== 'POST') {
			return new Response('Method Not Allowed', { status: 405 });
		}

		try {
			// Parse the eval ID from the URL path
			// Expected format: /_agentuity/eval/{evalId}
			const pathParts = req.url.split('/');
			const evalIdIndex = pathParts.indexOf('eval');
			if (evalIdIndex === -1 || evalIdIndex + 1 >= pathParts.length) {
				return new Response('Invalid eval ID in path', { status: 400 });
			}
			const evalId = pathParts[evalIdIndex + 1];

			// Parse request body
			const body = await this.parseRequestBody(req);
			if (!body) {
				return new Response('Invalid request body', { status: 400 });
			}

			// Type assertion for the body
			const evalBody = body as {
				input: string;
				output: string;
				sessionId: string;
				spanId: string;
				evalName: string;
			};

			// Validate required fields
			if (
				!evalBody.input ||
				!evalBody.output ||
				!evalBody.sessionId ||
				!evalBody.spanId ||
				!evalBody.evalName
			) {
				return new Response('Missing required fields', { status: 400 });
			}

			const evalAPI = new EvalAPI();

			// Run the eval
			const result = await evalAPI.runEval(
				evalBody.evalName, // evalName (slug)
				evalBody.input,
				evalBody.output,
				evalBody.sessionId,
				evalBody.spanId,
				evalId // evalId from URL path
			);

			return new Response(JSON.stringify(result), {
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		} catch (error) {
			this.logger.error('Internal eval route error:', error);
			return new Response(JSON.stringify({ error: (error as Error).message }), {
				status: 500,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			});
		}
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

		// Handle eval routes
		if (req.url.startsWith('/_agentuity/eval/')) {
			return this.handleEval(req);
		}

		// Add more internal routes here as needed
		// e.g., /_agentuity/analytics, /_agentuity/metrics, etc.

		return new Response('Internal route not found', { status: 404 });
	}

	/**
	 * Parses request body from different request types
	 */
	private async parseRequestBody(req: ServerRequest): Promise<unknown> {
		if (req.body) {
			// Handle ReadableStream body
			if (req.body instanceof ReadableStream) {
				const reader = req.body.getReader();
				const chunks: Uint8Array[] = [];
				let done = false;

				while (!done) {
					const { value, done: readerDone } = await reader.read();
					done = readerDone;
					if (value) {
						chunks.push(value);
					}
				}

				const bodyText = new TextDecoder().decode(
					new Uint8Array(
						chunks.reduce((acc, chunk) => {
							acc.push(...chunk);
							return acc;
						}, [] as number[])
					)
				);
				return JSON.parse(bodyText);
			}
		}

		return null;
	}
}
