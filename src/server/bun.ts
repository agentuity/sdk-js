import type { ReadableStream } from 'node:stream/web';
import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import EvalAPI from '../apis/eval';
import { isIdle } from '../router/context';
import type {
	AgentResponseData,
	AgentWelcomeResult,
	ReadableDataType,
} from '../types';
import {
	extractTraceContextFromBunRequest,
	injectTraceContextToHeaders,
} from './otel';
import type { Server, ServerRoute, UnifiedServerConfig } from './types';
import {
	createStreamingResponse,
	getRequestFromHeaders,
	getRoutesHelpText,
	shouldIgnoreStaticFile,
	toWelcomePrompt,
} from './util';

const idleTimeout = 255; // expressed in seconds

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

		let theserver: ReturnType<typeof Bun.serve> | null = null;

		const devmode = process.env.AGENTUITY_SDK_DEV_MODE === 'true';
		const { sdkVersion, logger } = this.config;
		const evalAPI = new EvalAPI();
		const hostname =
			process.env.AGENTUITY_ENV === 'development' ? '127.0.0.1' : '0.0.0.0';

		this.server = theserver = Bun.serve({
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
				'/_idle': {
					GET: async () => {
						if (isIdle()) {
							return new Response('OK', { status: 200 });
						}
						return new Response('NO', { status: 200 });
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
			},
			async fetch(req) {
				const method = req.method;

				if (method === 'OPTIONS') {
					return new Response('OK', {
						headers: {
							'Access-Control-Allow-Origin': '*',
							'Access-Control-Allow-Methods':
								'GET, PUT, DELETE, PATCH, OPTIONS, POST',
							'Access-Control-Allow-Headers': 'Content-Type, Authorization',
						},
					});
				}

				theserver?.timeout(req, 0);

				const url = new URL(req.url);

				// Handle eval endpoints
				if (method === 'POST' && url.pathname.startsWith('/eval/')) {
					const evalName = url.pathname.slice(6); // Remove '/eval/'
					try {
						const body = (await req.json()) as {
							input: string;
							output: string;
							sessionId: string;
						};
						const result = await evalAPI.runEval(
							evalName,
							body.input,
							body.output,
							body.sessionId
						);
						return new Response(JSON.stringify(result), {
							status: 200,
							headers: {
								'Content-Type': 'application/json',
								'Access-Control-Allow-Origin': '*',
							},
						});
					} catch (error) {
						logger.error('eval error:', error);
						return new Response(
							JSON.stringify({ error: (error as Error).message }),
							{
								status: 500,
								headers: {
									'Content-Type': 'application/json',
									'Access-Control-Allow-Origin': '*',
								},
							}
						);
					}
				}

				// Extract trace context from headers
				const extractedContext = extractTraceContextFromBunRequest(req);

				// Execute the request handler within the extracted context
				return context.with(extractedContext, async (): Promise<Response> => {
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
								const agentId = url.pathname.split('/')[1]; // in case we have extra path segments, we need to get the first one for agents
								const routeKey = `POST:/${agentId}`;
								const route = routeMap.get(routeKey);

								if (!route) {
									// ignore common static files
									if (
										method === 'GET' &&
										shouldIgnoreStaticFile(url.pathname)
									) {
										span.setAttribute('http.status_code', '404');
										return new Response('Not Found', {
											status: 404,
											headers: injectTraceContextToHeaders(),
										});
									}
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

								const runId = span.spanContext().traceId;

								try {
									const routeResult = route.handler({
										body:
											(req.body as unknown as
												| ReadableStream<ReadableDataType>
												| AsyncIterable<ReadableDataType>) ?? undefined,
										url: req.url,
										method,
										headers: req.headers.toJSON(),
										request: getRequestFromHeaders(req.headers.toJSON(), runId),
										setTimeout: (_val: number) => void 0,
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
