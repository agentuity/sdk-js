import {
	createServer as createHttpServer,
	type IncomingMessage,
} from 'node:http';
import { Readable } from 'node:stream';
import type { ReadableStream } from 'node:stream/web';
import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import EvalAPI from '../apis/eval';
import type { Logger } from '../logger';
import { isIdle } from '../router/context';
import type { AgentResponseData, AgentWelcomeResult } from '../types';
import {
	extractTraceContextFromNodeRequest,
	injectTraceContextToHeaders,
	injectTraceContextToNodeResponse,
} from './otel';
import type { Server, ServerRoute, UnifiedServerConfig } from './types';
import {
	createStreamingResponse,
	getRequestFromHeaders,
	getRoutesHelpText,
	safeStringify,
	shouldIgnoreStaticFile,
	toWelcomePrompt,
} from './util';

export const MAX_REQUEST_TIMEOUT = 60_000 * 10;

/**
 * Node.js implementation of the Server interface
 */
export class NodeServer implements Server {
	private readonly logger: Logger;
	private readonly port: number;
	private readonly routes: ServerRoute[];
	private readonly sdkVersion: string;
	private server: ReturnType<typeof createHttpServer> | null = null;

	/**
	 * Creates a new Node.js server
	 *
	 * @param config - The server configuration
	 */
	constructor({ logger, port, routes, sdkVersion }: UnifiedServerConfig) {
		this.logger = logger;
		this.port = port;
		this.routes = routes;
		this.sdkVersion = sdkVersion;
	}

	/**
	 * Stops the server
	 */
	async stop(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.server) {
				const server = this.server;
				this.server = null;
				server.close((err?: Error | null) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				});
			}
		});
	}

	private getBufferAsStream(
		req: IncomingMessage
	): Promise<ReadableStream<Buffer>> {
		return new Promise((resolve, reject) => {
			const chunks: Buffer[] = [];
			req.on('data', (chunk) => chunks.push(chunk));
			req.on('end', async () => {
				const body = Buffer.concat(chunks);
				const readable = Readable.from(body);
				resolve(Readable.toWeb(readable) as ReadableStream<Buffer>);
			});
			req.on('error', (err) => {
				reject(err);
			});
		});
	}

	/**
	 * Gets the headers from the request
	 */
	private getHeaders(req: IncomingMessage) {
		const headers: Record<string, string> = {};
		for (const [key, value] of Object.entries(req.headers)) {
			if (typeof value === 'string') {
				headers[key] = value;
			} else if (Array.isArray(value)) {
				headers[key] = value[0] || '';
			}
		}
		return headers;
	}

	/**
	 * Starts the server
	 */
	async start(): Promise<void> {
		const sdkVersion = this.sdkVersion;
		const devmode = process.env.AGENTUITY_SDK_DEV_MODE === 'true';
		const evalAPI = new EvalAPI();
		this.server = createHttpServer(async (req, res) => {
			if (req.method === 'GET' && req.url === '/_health') {
				res.writeHead(200, {
					'x-agentuity-version': sdkVersion,
				});
				res.end();
				return;
			}
			if (req.method === 'GET' && req.url === '/') {
				res.writeHead(200, {
					'Content-Type': 'text/plain',
				});
				res.end(
					getRoutesHelpText(req.headers.host ?? '127.0.0.1:3500', this.routes)
				);
				return;
			}

			if (req.method === 'OPTIONS') {
				res.writeHead(200, {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods':
						'GET, PUT, DELETE, PATCH, OPTIONS, POST',
					'Access-Control-Allow-Headers': 'Content-Type, Authorization',
				});
				res.end();
				return;
			}

			// Handle eval endpoints
			if (req.method === 'POST' && req.url?.startsWith('/eval/')) {
				const evalName = req.url.slice(6); // Remove '/eval/'
				try {
					let body = '';
					for await (const chunk of req) {
						body += chunk;
					}
					const parsedBody = JSON.parse(body) as {
						input: string;
						output: string;
						sessionId: string;
					};
					const result = await evalAPI.runEval(
						evalName,
						parsedBody.input,
						parsedBody.output,
						parsedBody.sessionId
					);
					res.writeHead(200, {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					});
					res.end(JSON.stringify(result));
				} catch (error) {
					this.logger.error('eval error:', error);
					res.writeHead(500, {
						'Content-Type': 'application/json',
						'Access-Control-Allow-Origin': '*',
					});
					res.end(JSON.stringify({ error: (error as Error).message }));
				}
				return;
			}

			if (req.method === 'GET' && req.url === '/welcome') {
				const result: Record<string, AgentWelcomeResult> = {};
				for (const route of this.routes) {
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
				res.writeHead(200, {
					'Content-Type': 'application/json',
				});
				res.end(safeStringify(result));
				return;
			}

			if (req.method === 'GET' && req.url === '/_idle') {
				if (isIdle()) {
					return new Response('OK', { status: 200 });
				}
				return new Response('NO', { status: 200 });
			}

			if (req.method === 'GET' && req.url === '/welcome/') {
				let content: AgentWelcomeResult | null = null;
				for (const route of this.routes) {
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
						content = r;
						break;
					}
				}
				if (content) {
					res.writeHead(200, {
						'Content-Type': 'application/json',
					});
					res.end(JSON.stringify(content));
					return;
				}
				res.writeHead(404);
				res.end();
			}

			// Extract trace context from headers
			const extractedContext = extractTraceContextFromNodeRequest(req);

			// Execute the request handler within the extracted context
			await context.with(extractedContext, async () => {
				// Create a span for this incoming request
				await trace.getTracer('http-server').startActiveSpan(
					`HTTP ${req.method}`,
					{
						kind: SpanKind.SERVER,
						attributes: {
							'http.method': req.method || 'UNKNOWN',
							'http.path': req.url,
							'http.url': req.url || '', // FIXME should be full url
							'http.host': req.headers.host || '',
							'http.user_agent': req.headers['user-agent'] || '',
						},
					},
					async (span) => {
						try {
							const route = this.routes.find((r) => r.path === req.url);
							if (!route) {
								if (
									req.method === 'GET' &&
									shouldIgnoreStaticFile(req.url ?? '/')
								) {
									span.setAttribute('http.status_code', '404');
									res.writeHead(404, injectTraceContextToHeaders());
									res.end();
									return;
								}
								this.logger.error(
									'agent not found: %s for: %s',
									req.method,
									req.url
								);
								span.setAttribute('http.status_code', '404');
								res.writeHead(404, injectTraceContextToHeaders());
								res.end();
								span.setStatus({
									code: SpanStatusCode.ERROR,
									message: `No Agent found at ${req.url}`,
								});
								return;
							}

							if (req.method !== route.method) {
								this.logger.error(
									'unsupported method: %s for: %s',
									req.method,
									req.url
								);
								span.setAttribute('http.status_code', '405');
								res.writeHead(405, injectTraceContextToHeaders());
								res.end();
								span.setStatus({
									code: SpanStatusCode.ERROR,
									message: `Method not allowed: ${req.method} ${req.url}`,
								});
								return;
							}

							span.setAttribute('@agentuity/agentName', route.agent.name);
							span.setAttribute('@agentuity/agentId', route.agent.id);

							const runId = span.spanContext().traceId;

							this.logger.debug('request: %s %s', req.method, req.url);

							try {
								const agentReq = {
									body: await this.getBufferAsStream(req),
									request: getRequestFromHeaders(
										req.headers as Record<string, string>,
										runId
									),
									url: req.url ?? '',
									method: req.method ?? '',
									headers: this.getHeaders(req),
									setTimeout: (val: number) => req.setTimeout(val),
								};
								const routeResult = route.handler(agentReq);
								const response = await createStreamingResponse(
									req.headers.origin ?? null,
									`Agentuity NodeJS/${sdkVersion}`,
									span,
									routeResult as Promise<AgentResponseData>
								);
								const outheaders: Record<string, string> = {};
								const headers = response.headers as Headers;
								headers.forEach((value, key) => {
									outheaders[key] = value;
								});
								res.writeHead(response.status, outheaders);
								res.flushHeaders();
								if (response.body) {
									const reader = response.body.getReader();
									while (true) {
										const { done, value } = await reader.read();
										if (value) {
											res.write(value);
										}
										if (done) {
											break;
										}
									}
								}
								res.end();
							} catch (err) {
								this.logger.error('Server error', err);
								try {
									injectTraceContextToNodeResponse(res);
								} catch (err) {
									this.logger.error('Error injecting trace context: %s', err);
								}
								res.setHeader('Content-Type', 'text/plain');
								res.writeHead(500);
								const { stack, message } = err as Error;
								let errorMessage = message;
								if (devmode) {
									errorMessage = stack ?? errorMessage;
								}
								res.end(errorMessage);
								span.recordException(err as Error);
								span.setAttribute('http.status_code', '500');
								span.setStatus({
									code: SpanStatusCode.ERROR,
									message: (err as Error).message,
								});
							}
						} finally {
							span.end();
						}
					}
				);
			});
		});

		return new Promise((resolve) => {
			const server = this.server as ReturnType<typeof createHttpServer>;
			server.requestTimeout = MAX_REQUEST_TIMEOUT;
			server.timeout = MAX_REQUEST_TIMEOUT;
			const address =
				process.env.AGENTUITY_ENV === 'development' ? '127.0.0.1' : '0.0.0.0';
			server.listen(this.port, address, () => {
				this.logger.info(`Node server listening on port ${this.port}`);
				resolve();
			});
		});
	}
}
