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
import type { AgentResponseType } from '../types';
import { callbackAgentHandler } from './agents';
import { context, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import {
	extractTraceContextFromNodeRequest,
	injectTraceContextToNodeResponse,
} from './otel';

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
				const payload = JSON.parse(body.toString());
				resolve(payload as T);
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
			let payload: IncomingRequest;
			try {
				payload = await this.getJSON<IncomingRequest>(req);
			} catch (err) {
				this.logger.error('Error parsing request body as json: %s', err);
				res.writeHead(400);
				res.end();
			}

			// Extract trace context from headers
			const extractedContext = extractTraceContextFromNodeRequest(req);

			// Execute the request handler within the extracted context
			await context.with(extractedContext, async () => {
				// Create a span for this incoming request
				await trace.getTracer('http-server').startActiveSpan(
					`${req.method} ${req.url}`,
					{
						kind: SpanKind.SERVER,
						attributes: {
							'http.method': req.method || 'UNKNOWN',
							'http.url': req.url || '',
							'http.host': req.headers.host || '',
							'http.user_agent': req.headers['user-agent'] || '',
						},
					},
					async (span) => {
						try {
							if (req.method === 'GET' && req.url === '/_health') {
								injectTraceContextToNodeResponse(res);
								res.writeHead(200);
								res.end();
								span.setStatus({ code: SpanStatusCode.OK });
								return;
							}

							if (req.method === 'POST' && req.url?.startsWith('/_reply/')) {
								const id = req.url.slice(8);
								const body = await this.getJSON<AgentResponseType>(req);
								callbackAgentHandler.received(id, body);
								span.setStatus({ code: SpanStatusCode.OK });
								injectTraceContextToNodeResponse(res);
								res.writeHead(202);
								res.end('OK');
								return;
							}

							const route = this.routes.find((r) => r.path === req.url);
							if (!route) {
								this.logger.error(
									'agent not found: %s for: %s',
									req.method,
									req.url
								);
								res.writeHead(404);
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
								res.writeHead(405);
								res.end();
								span.setStatus({
									code: SpanStatusCode.ERROR,
									message: `Method not allowed: ${req.method} ${req.url}`,
								});
								return;
							}

							try {
								const agentReq = {
									request: payload as IncomingRequest,
									url: req.url ?? '',
									headers: this.getHeaders(req),
								};
								const response = await route.handler(agentReq);
								injectTraceContextToNodeResponse(res);
								res.writeHead(200, {
									'Content-Type': 'application/json',
									Server: `Agentuity NodeJS/${sdkVersion}`,
								});
								res.end(JSON.stringify(response));
								span.setStatus({ code: SpanStatusCode.OK });
							} catch (err) {
								this.logger.error('Server error', err);
								injectTraceContextToNodeResponse(res);
								res.writeHead(500);
								res.end();
								span.recordException(err as Error);
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
			server.listen(this.port, () => {
				this.logger.info(`Node server listening on port ${this.port}`);
				resolve();
			});
		});
	}
}
