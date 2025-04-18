import type {
	IncomingRequest,
	Server,
	ServerRoute,
	UnifiedServerConfig,
} from './types';
import type { Logger } from '../logger';
import {
	createServer as createHttpServer,
	type IncomingMessage,
} from 'node:http';
import { context, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import {
	extractTraceContextFromNodeRequest,
	injectTraceContextToHeaders,
	injectTraceContextToNodeResponse,
} from './otel';
import {
	safeStringify,
	safeParse,
	getRoutesHelpText,
	createStreamingResponse,
	toWelcomePrompt,
} from './util';
import type { AgentWelcomeResult } from '../types';

export const MAX_REQUEST_TIMEOUT = 60_000 * 10;

/**
 * Node.js implementation of the Server interface
 */
export class NodeServer implements Server {
	private readonly logger: Logger;
	private readonly port: number;
	private readonly routes: ServerRoute[];
	private server: ReturnType<typeof createHttpServer> | null = null;
	private readonly sdkVersion: string;

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

	private getJSON<T>(req: IncomingMessage): Promise<T> {
		return new Promise((resolve, reject) => {
			const chunks: Buffer[] = [];
			req.on('data', (chunk) => chunks.push(chunk));
			req.on('end', async () => {
				const body = Buffer.concat(chunks);
				const payload = safeParse(body.toString());
				resolve(payload as T);
			});
			req.on('error', (err) => {
				reject(err);
			});
		});
	}

	private getBuffer(req: IncomingMessage): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			const chunks: Buffer[] = [];
			req.on('data', (chunk) => chunks.push(chunk));
			req.on('end', async () => {
				const body = Buffer.concat(chunks);
				resolve(body);
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
		const { sdkVersion } = this;
		this.server = createHttpServer(async (req, res) => {
			if (req.method === 'GET' && req.url === '/_health') {
				res.writeHead(200);
				res.end();
				return;
			}
			if (req.method === 'GET' && req.url === '/') {
				res.writeHead(200, {
					'Content-Type': 'text/plain',
				});
				res.end(
					getRoutesHelpText(req.headers.host ?? 'localhost:3500', this.routes)
				);
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
				res.end(JSON.stringify(result));
				return;
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

			if (req.method !== 'POST') {
				res.writeHead(405);
				res.end();
				return;
			}

			// Extract trace context from headers
			const extractedContext = extractTraceContextFromNodeRequest(req);

			// Execute the request handler within the extracted context
			await context.with(extractedContext, async () => {
				if (req.url?.startsWith('/run/agent_')) {
					const id = req.url.slice(5);
					const body = await this.getBuffer(req);
					const response = await fetch(`http://127.0.0.1:${this.port}/${id}`, {
						method: 'POST',
						body: safeStringify({
							trigger: 'manual',
							payload: body.toString('base64'),
							contentType:
								req.headers['content-type'] || 'application/octet-stream',
							metadata: { headers: this.getHeaders(req) },
						}),
						headers: {
							'Content-Type': 'application/json',
							'User-Agent': req.headers['user-agent'] || '',
						},
					});
					const respBody = (await response.json()) as {
						contentType: string;
						payload: string;
					};
					res.writeHead(response.status, {
						...injectTraceContextToHeaders(),
						'Content-Type': respBody.contentType,
						Server: response.headers.get('Server') || '',
					});
					const output = Buffer.from(respBody.payload, 'base64');
					res.write(output);
					res.end();
					return;
				}

				if (!req.headers?.['content-type']?.includes('json')) {
					res.writeHead(400, injectTraceContextToHeaders());
					res.write('Invalid content type, expected application/json');
					res.end();
					return;
				}

				let payload: IncomingRequest;
				try {
					payload = await this.getJSON<IncomingRequest>(req);
				} catch (err) {
					this.logger.error('Error parsing request body as json: %s', err);
					res.writeHead(400, injectTraceContextToHeaders());
					res.end();
				}

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
							this.logger.debug('request: %s %s', req.method, req.url);

							try {
								const agentReq = {
									request: payload as IncomingRequest,
									url: req.url ?? '',
									headers: this.getHeaders(req),
									setTimeout: (val: number) => req.setTimeout(val),
								};
								const routeResult = route.handler(agentReq);
								const [headers, stream] = createStreamingResponse(
									`Agentuity NodeJS/${sdkVersion}`,
									new Headers(req.headers as Record<string, string>),
									span,
									routeResult
								);
								res.writeHead(200, injectTraceContextToHeaders(headers));
								// Ensure headers are sent before streaming
								res.flushHeaders();
								// Pipe the stream to the response
								const reader = stream.getReader();
								while (true) {
									const { done, value } = await reader.read();
									if (done) break;
									res.write(value);
								}
								res.end();
							} catch (err) {
								this.logger.error('Server error', err);
								injectTraceContextToNodeResponse(res);
								res.writeHead(500);
								res.end();
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
			server.listen(this.port, () => {
				this.logger.info(`Node server listening on port ${this.port}`);
				resolve();
			});
		});
	}
}
