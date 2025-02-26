import {
	context,
	trace,
	propagation,
	SpanStatusCode,
} from '@opentelemetry/api';

export const __originalFetch = fetch; // save the original fetch before we patch it

// Helper function to instrument fetch
export function instrumentFetch() {
	const patch = async function (
		input: string | Request | URL,
		init: RequestInit | undefined
	) {
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

		return trace.getActiveSpan()
			? trace.getTracer('fetch').startActiveSpan(
					`HTTP ${method}`,
					{
						attributes: {
							'http.url': url,
							'http.method': method,
						},
					},
					async (span) => {
						try {
							// Add trace context to headers
							const headers = new Headers(init?.headers || {});
							const carrier: Record<string, string> = {};

							// Use the current active context which contains the parent span
							propagation.inject(context.active(), carrier);

							// Copy the carrier properties to headers
							Object.entries(carrier).forEach(([key, value]) => {
								headers.set(key, value);
							});

							// Create new init object with updated headers
							const newInit = {
								...init,
								headers,
							};

							const response = await __originalFetch(input, newInit);

							// Add response attributes to span
							span.setAttributes({
								'http.status_code': response.status,
								'http.status_text': response.statusText,
							});

							if (!response.ok) {
								span.setStatus({ code: SpanStatusCode.ERROR });
							} else {
								span.setStatus({ code: SpanStatusCode.OK });
							}

							return response;
						} catch (error) {
							span.recordException(error as Error);
							span.setStatus({ code: SpanStatusCode.ERROR });
							throw error;
						} finally {
							span.end();
						}
					}
				)
			: __originalFetch(input, init); // If no active span, just call original fetch
	};
	globalThis.fetch = patch;
}
