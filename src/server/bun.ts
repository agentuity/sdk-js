import type {
	Server,
	UnifiedServerConfig,
	ServerRoute,
	IncomingRequest,
} from './types';
import { context, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import {
	extractTraceContextFromBunRequest,
	injectTraceContextToHeaders,
} from './otel';
import {
	safeStringify,
	getRoutesHelpText,
	createStreamingResponse,
	toWelcomePrompt,
} from './util';
import type { AgentWelcomeResult } from '../types';
const idleTimeout = 255; // expressed in seconds
const timeout = 600;

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
			idleTimeout: idleTimeout,
			routes: {
				'/': {
					GET: async (req) => {
						const helpText = getRoutesHelpText(
							req.headers.get('host') ?? 'localhost:3500',
							this.config.routes
						);
						return new Response(helpText, {
							headers: {
								'Content-Type': 'text/plain',
							},
						});
					},
				},
				'/_health': new Response('OK'),
				'/welcome': {
					GET: async () => {
						const result: Record<string, AgentWelcomeResult> = {};
						for (const route of this.config.routes) {
							if (route.welcome) {
								let r = route.welcome();
								if (r instanceof Promise) {
									r = await r;
								}
								if (r.prompts) {
									for (let c = 0; c < r.prompts.length; c++) {
										const p = r.prompts[c];
										r.prompts[c] = await toWelcomePrompt(p);
									}
								}
								result[route.agent.id] = r;
							}
						}
						return new Response(JSON.stringify(result), {
							headers: {
								'Content-Type': 'application/json',
							},
						});
					},
				},
				'/welcome/:id': {
					GET: async (req) => {
						const url = new URL(req.url);
						const id = url.pathname.slice(5);
						for (const route of this.config.routes) {
							if (route.agent.id === id && route.welcome) {
								let r = route.welcome();
								if (r instanceof Promise) {
									r = await r;
								}
								if (r.prompts) {
									for (let c = 0; c < r.prompts.length; c++) {
										const p = r.prompts[c];
										r.prompts[c] = await toWelcomePrompt(p);
									}
								}
								return new Response(JSON.stringify(r), {
									headers: {
										'Content-Type': 'application/json',
									},
								});
							}
						}
						return new Response('Not Found', {
							status: 404,
						});
					},
				},
				'/run/:id': {
					POST: async (req) => {
						// Extract trace context from headers
						const extractedContext = extractTraceContextFromBunRequest(req);

						// Execute the request handler within the extracted context
						return context.with(extractedContext, async () => {
							this.server?.timeout(req, timeout);
							const url = new URL(req.url);
							const id = url.pathname.slice(5);
							const body = await req.arrayBuffer();
							const headers = req.headers.toJSON();
							const resp = await fetch(
								`http://127.0.0.1:${this.config.port}/${id}`,
								{
									method: 'POST',
									body: safeStringify({
										trigger: 'manual',
										payload: Buffer.from(body).toString('base64'),
										contentType:
											req.headers.get('content-type') ??
											'application/octet-stream',
										metadata: { headers },
									}),
									headers: {
										'Content-Type': 'application/json',
									},
								}
							);
							if (resp.ok) {
								const response = await resp.json();
								const buf = Buffer.from(response.payload, 'base64');
								return new Response(buf, {
									status: resp.status,
									headers: {
										...injectTraceContextToHeaders(resp.headers),
										'Content-Type': response.contentType,
										'Content-Length': buf.byteLength.toString(),
									},
								});
							}
							return new Response(resp.body, {
								status: resp.status,
								headers: injectTraceContextToHeaders(resp.headers),
							});
						});
					},
				},
				'/:agentId': {
					POST: async (req) => {
						const url = new URL(req.url);
						const method = req.method;

						if (method !== 'POST') {
							return new Response('Method not allowed', {
								status: 405,
								headers: injectTraceContextToHeaders(),
							});
						}
						if (!req.headers.get('content-type')?.includes('json')) {
							return new Response(
								'Invalid Content-Type, Expected application/json',
								{
									status: 400,
									headers: injectTraceContextToHeaders(),
								}
							);
						}
						this.server?.timeout(req, timeout);

						// Extract trace context from headers
						const extractedContext = extractTraceContextFromBunRequest(req);

						// Execute the request handler within the extracted context
						return context.with(extractedContext, async () => {
							const body = await req.json();

							// Create a span for this incoming request
							return trace.getTracer('http-server').startActiveSpan(
								`HTTP ${method}`,
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
										const routeKey = `${method}:${url.pathname}`;
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
											return new Response('Not Found', {
												status: 404,
												headers: injectTraceContextToHeaders(),
											});
										}

										span.setAttribute('@agentuity/agentName', route.agent.name);
										span.setAttribute('@agentuity/agentId', route.agent.id);
										logger.debug('request: %s %s', method, url.pathname);

										try {
											const routeResult = route.handler({
												url: req.url,
												headers: req.headers.toJSON(),
												request: body as IncomingRequest,
												setTimeout: (val: number) =>
													this.server?.timeout(req, val),
											});

											const [headers, stream] = createStreamingResponse(
												`Agentuity BunJS/${sdkVersion}`,
												req.headers,
												span,
												routeResult
											);

											return new Response(stream, {
												status: 200,
												headers: injectTraceContextToHeaders(headers),
											});
										} catch (error) {
											span.recordException(error as Error);
											span.setStatus({
												code: SpanStatusCode.ERROR,
												message: (error as Error).message,
											});
											return new Response('Internal Server Error', {
												status: 500,
												headers: injectTraceContextToHeaders(),
											});
										}
									} finally {
										span.end();
									}
								}
							);
						});
					},
				},
			},
			async fetch() {
				return new Response('Not Found', {
					status: 404,
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
