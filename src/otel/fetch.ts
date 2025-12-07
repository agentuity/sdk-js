import {
	context,
	propagation,
	SpanStatusCode,
	trace,
} from '@opentelemetry/api';

/**
 * Reference to the original fetch function before instrumentation
 */
export const __originalFetch = fetch; // save the original fetch before we patch it

/**
 * Instruments the global fetch function with OpenTelemetry tracing
 *
 * Replaces the global fetch with an instrumented version that creates spans
 * for each HTTP request and propagates trace context in headers
 */
export function instrumentFetch() {
	const patch = async (
		input: string | Request | URL,
		init: RequestInit | undefined
	): Promise<Response> => {
		const url =
			typeof input === 'string'
				? input
				: input instanceof URL
					? input.toString()
					: input.url;

		const method =
			init?.method ||
			(typeof input !== 'string' && !(input instanceof URL)
				? input.method || 'GET'
				: 'GET');

		// Get the active span if it exists
		const activeSpan = trace.getActiveSpan();

		// If there's no active span, just call the original fetch
		if (!activeSpan) {
			return __originalFetch(input, init);
		}

		// Get the current active context
		const currentContext = context.active();
		const _url = new URL(url);

		// Create a child span using the current context
		const childSpan = trace.getTracer('fetch').startSpan(
			`HTTP ${method}`,
			{
				attributes: {
					'http.url': url,
					'http.path': _url.pathname,
					'http.method': method,
					host: _url.host,
				},
			},
			currentContext
		);

		try {
			// Prepare trace context injection
			const carrier: Record<string, string> = {};

			// Create a new context with the child span
			const newContext = trace.setSpan(currentContext, childSpan);

			// Use the new context for propagation
			propagation.inject(newContext, carrier);

			// Preserve original headers and add trace context
			// Handle different header formats (Headers object, plain object, array)
			let newInit: RequestInit;
			if (init?.headers) {
				// Clone existing headers to avoid mutation
				const headers = new Headers(init.headers);
				// Add trace context headers
				for (const [key, value] of Object.entries(carrier)) {
					// Only add if not already present to avoid overwriting
					if (!headers.has(key)) {
						headers.set(key, value);
					}
				}
				newInit = {
					...init,
					headers,
				};
			} else {
				// No existing headers, just add trace context
				newInit = {
					...init,
					headers: carrier,
				};
			}

			const response = await __originalFetch(input, newInit);

			// Add response attributes to span
			childSpan.setAttributes({
				'http.status_code': response.status,
				'http.user_agent': response.headers.get('user-agent') || '',
			});

			if (!response.ok) {
				childSpan.setStatus({ code: SpanStatusCode.ERROR });
			} else {
				childSpan.setStatus({ code: SpanStatusCode.OK });
			}

			return response;
		} catch (error) {
			childSpan.recordException(error as Error);
			childSpan.setStatus({ code: SpanStatusCode.ERROR });
			throw error;
		} finally {
			childSpan.end();
		}
	};
	globalThis.fetch = patch as typeof fetch;
}
