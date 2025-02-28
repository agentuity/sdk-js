import type {
	Server,
	UnifiedServerConfig,
	ServerRoute,
	IncomingRequest,
} from './types';
import { callbackAgentHandler } from './agents';
import {
	context,
	propagation,
	trace,
	SpanKind,
	SpanStatusCode,
} from '@opentelemetry/api';

/**
 * Bun implementation of the Server interface
 */
export class BunServer implements Server {
	private server: ReturnType<typeof Bun.serve> | null = null;
	private config: UnifiedServerConfig;

	/**
	 * Creates a new Bun server
	 *
	 * @param config - The server configuration
	 */
	constructor(config: UnifiedServerConfig) {
		this.config = config;
	}

	/**
	 * Starts the server
	 *
	 * @throws Error if the server is already running
	 */
	async start(): Promise<void> {
		if (this.server) {
			throw new Error('Server is already running');
		}

		const routeMap = new Map<string, ServerRoute>();

		// Create a map of routes for faster lookup
		for (const route of this.config.routes) {
			const key = `${route.method}:${route.path}`;
			routeMap.set(key, route);
		}

		const { sdkVersion, logger } = this.config;

		this.server = Bun.serve({
			port: this.config.port,
			async fetch(req) {
				// Extract trace context from headers
				const extractedContext = extractTraceContext(req);

				// Execute the request handler within the extracted context
				return context.with(extractedContext, async () => {
					const url = new URL(req.url);
					const method = req.method;

					// Create a span for this incoming request
					return trace.getTracer('http-server').startActiveSpan(
						`${method} ${url.pathname}`,
						{
							kind: SpanKind.SERVER,
							attributes: {
								'http.method': method,
								'http.url': req.url,
								'http.host': url.host,
								'http.user_agent': req.headers.get('user-agent') || '',
								'http.path': url.pathname,
							},
						},
						async (span) => {
							try {
								if (method === 'GET' && url.pathname === '/_health') {
									span.setStatus({ code: SpanStatusCode.OK });
									return new Response('OK', { status: 200 });
								}

								if (method === 'POST' && url.pathname.startsWith('/_reply/')) {
									const id = url.pathname.slice(8);
									const body = await req.json();
									callbackAgentHandler.received(id, body);
									span.setStatus({ code: SpanStatusCode.OK });
									return new Response('OK', { status: 202 });
								}

								const routeKey = `${method}:${url.pathname}`;

								logger.debug('request: %s %s', method, url.pathname);

								const route = routeMap.get(routeKey);

								if (!route) {
									logger.error(
										'agent not found: %s for: %s',
										method,
										url.pathname
									);
									span.setStatus({
										code: SpanStatusCode.ERROR,
										message: `No Agent found at ${url.pathname}`,
									});
									return new Response('Not Found', { status: 404 });
								}

								try {
									const body = await req.json();

									const resp = await route.handler({
										url: req.url,
										headers: req.headers.toJSON(),
										request: body as IncomingRequest,
									});
									span.setStatus({ code: SpanStatusCode.OK });
									return new Response(JSON.stringify(resp), {
										headers: {
											'Content-Type': 'application/json',
											Server: `Agentuity BunJS/${sdkVersion}`,
										},
									});
								} catch (error) {
									span.recordException(error as Error);
									span.setStatus({
										code: SpanStatusCode.ERROR,
										message: (error as Error).message,
									});
									return new Response('Internal Server Error', { status: 500 });
								}
							} finally {
								span.end();
							}
						}
					);
				});
			},
		});

		this.config.logger.info('Bun server started on port %d', this.config.port);
	}

	/**
	 * Stops the server
	 */
	async stop(): Promise<void> {
		if (!this.server) {
			return;
		}
		const server = this.server;
		this.server = null;
		this.config.logger.debug('server stopping');
		await server.stop();
		this.config.logger.info('server stopped');
	}
}

/**
 * Extract trace context from incoming request headers
 */
function extractTraceContext(req: Request) {
	// Create a carrier object from the headers
	const carrier: Record<string, string> = {};

	// Convert headers to the format expected by the propagator
	req.headers.forEach((value, key) => {
		carrier[key] = value;
	});

	// Extract the context using the global propagator
	const activeContext = context.active();
	return propagation.extract(activeContext, carrier);
}
