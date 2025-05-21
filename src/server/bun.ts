import type { Server, UnifiedServerConfig, ServerRoute } from './types';
import type { ReadableStream } from 'node:stream/web';
import { context, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import {
	extractTraceContextFromBunRequest,
	injectTraceContextToHeaders,
} from './otel';
import {
	getRoutesHelpText,
	createStreamingResponse,
	toWelcomePrompt,
	getRequestFromHeaders,
} from './util';
import type {
	AgentResponseData,
	AgentWelcomeResult,
	ReadableDataType,
} from '../types';
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

		const devmode = process.env.AGENTUITY_SDK_DEV_MODE === 'true';
		const { sdkVersion, logger } = this.config;
		const hostname =
			process.env.AGENTUITY_ENV === 'development' ? '127.0.0.1' : '0.0.0.0';

		this.server = Bun.serve({
			port: this.config.port,
			hostname,
			idleTimeout: idleTimeout,
			routes: {
				'/': {
					GET: async (req) => {
						const helpText = getRoutesHelpText(
							req.headers.get('host') ?? '127.0.0.1:3500',
							this.config.routes
						);
						return new Response(helpText, {
							headers: {
								'Content-Type': 'text/plain',
							},
						});
					},
				},
				'/_health': new Response('OK', {
					headers: {
						'x-agentuity-binary': 'true',
						'x-agentuity-version': sdkVersion,
					},
				}),
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
				'/:agentId': {
					OPTIONS: async () => {
						return new Response('OK', {
							headers: {
								'Access-Control-Allow-Origin': '*',
								'Access-Control-Allow-Methods': 'OPTIONS, POST',
								'Access-Control-Allow-Headers': 'Content-Type, Authorization',
							},
						});
					},
					POST: async (req) => {
						const url = new URL(req.url);
						const method = req.method;

						this.server?.timeout(req, timeout);

						// Extract trace context from headers
						const extractedContext = extractTraceContextFromBunRequest(req);

						// Execute the request handler within the extracted context
						return context.with(
							extractedContext,
							async (): Promise<Response> => {
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
									async (span): Promise<Response> => {
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

											span.setAttribute(
												'@agentuity/agentName',
												route.agent.name
											);
											span.setAttribute('@agentuity/agentId', route.agent.id);
											logger.debug('request: %s %s', method, url.pathname);

											const runId = span.spanContext().traceId;

											try {
												const routeResult = route.handler({
													body:
														(req.body as unknown as
															| ReadableStream<ReadableDataType>
															| AsyncIterable<ReadableDataType>) ?? undefined,
													url: req.url,
													headers: req.headers.toJSON(),
													request: getRequestFromHeaders(
														req.headers.toJSON(),
														runId
													),
													setTimeout: (val: number) =>
														this.server?.timeout(req, val),
												});

												return createStreamingResponse(
													req.headers.get('origin'),
													`Agentuity BunJS/${sdkVersion}`,
													span,
													routeResult as Promise<AgentResponseData>
												);
											} catch (error) {
												span.recordException(error as Error);
												span.setStatus({
													code: SpanStatusCode.ERROR,
													message: (error as Error).message,
												});
												span.setAttribute('http.status_code', '500');
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
							}
						);
					},
				},
			},
			async fetch() {
				return new Response('Not Found', {
					status: 404,
				});
			},
			error(error) {
				const { stack, message } = error as Error;
				let errorMessage = message;
				if (devmode) {
					errorMessage = stack ?? errorMessage;
				}
				return new Response(errorMessage, {
					status: 500,
					headers: {
						'Content-Type': 'text/plain',
					},
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
