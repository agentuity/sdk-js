import type { IncomingMessage, ServerResponse } from 'node:http';
import { context, propagation } from '@opentelemetry/api';

/**
 * Injects trace context into response headers using the OpenTelemetry propagation API
 *
 * @param headers - Optional existing headers to include
 * @returns A record of headers with trace context injected
 */
export function injectTraceContextToHeaders(
	headers: Record<string, string> | Headers = {}
): Record<string, string> {
	let _headers = headers;
	if (headers instanceof Headers) {
		_headers = headers.toJSON() as Record<string, string>;
	}
	// Create a carrier object for the headers
	const carrier: Record<string, string> = { ..._headers } as Record<
		string,
		string
	>;

	// Get the current context
	const currentContext = context.active();

	// Inject trace context into the carrier
	propagation.inject(currentContext, carrier);

	return carrier;
}

/**
 * Injects trace context into Node.js ServerResponse headers
 *
 * @param res - The Node.js ServerResponse object
 */
export function injectTraceContextToNodeResponse(res: ServerResponse): void {
	// Create a carrier object for the headers
	const carrier: Record<string, string> = {};

	// Get the current context
	const currentContext = context.active();

	// Inject trace context into the carrier
	propagation.inject(currentContext, carrier);

	// Add the headers to the response
	for (const [key, value] of Object.entries(carrier)) {
		res.setHeader(key, value);
	}
}

/**
 * Extracts trace context from incoming request headers
 *
 * @param headers - The request headers
 * @returns The context with trace information
 */
export function extractTraceContextFromHeaders(
	headers: Record<string, string>
): ReturnType<typeof propagation.extract> {
	// Create a carrier object from the headers
	const carrier: Record<string, string> = {};

	// Convert headers to lowercase for case-insensitive matching
	for (const [key, value] of Object.entries(headers)) {
		carrier[key.toLowerCase()] = value;
	}

	// Extract the context using the global propagator
	const activeContext = context.active();
	return propagation.extract(activeContext, carrier);
}

/**
 * Extracts trace context from Node.js IncomingMessage headers
 *
 * @param req - The Node.js IncomingMessage object
 * @returns The context with trace information
 */
export function extractTraceContextFromNodeRequest(
	req: IncomingMessage
): ReturnType<typeof propagation.extract> {
	// Create a carrier object from the headers
	const carrier: Record<string, string> = {};

	// Convert headers to the format expected by the propagator
	for (const [key, value] of Object.entries(req.headers)) {
		if (typeof value === 'string') {
			carrier[key.toLowerCase()] = value;
		} else if (Array.isArray(value)) {
			carrier[key.toLowerCase()] = value[0] || '';
		}
	}

	// Extract the context using the global propagator
	const activeContext = context.active();
	return propagation.extract(activeContext, carrier);
}

/**
 * Extracts trace context from Bun Request headers
 *
 * @param req - The Bun Request object
 * @returns The context with trace information
 */
export function extractTraceContextFromBunRequest(
	req: Request
): ReturnType<typeof propagation.extract> {
	// Create a carrier object from the headers
	const carrier: Record<string, string> = {};

	// Convert headers to the format expected by the propagator
	req.headers.forEach((value, key) => {
		carrier[key.toLowerCase()] = value;
	});

	// Extract the context using the global propagator
	const activeContext = context.active();
	return propagation.extract(activeContext, carrier);
}
