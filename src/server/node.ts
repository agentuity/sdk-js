import type {
	IncomingRequest,
	Server,
	ServerRoute,
	UnifiedServerConfig,
} from './types';
import type { Logger } from '../logger';
import { createServer as createHttpServer, IncomingMessage } from 'node:http';
import type { AgentResponseType } from '../types';
import { callbackAgentHandler } from './agents';
import {
	context,
	propagation,
	trace,
	SpanKind,
	SpanStatusCode,
} from '@opentelemetry/api';

export class NodeServer implements Server {
	private readonly logger: Logger;
	private readonly port: number;
	private readonly routes: ServerRoute[];
	private server: ReturnType<typeof createHttpServer> | null = null;
	private readonly sdkVersion: string;

	constructor({ logger, port, routes, sdkVersion }: UnifiedServerConfig) {
		this.logger = logger;
		this.port = port;
		this.routes = routes;
		this.sdkVersion = sdkVersion;
	}

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

	private getHeaders(req: IncomingMessage) {
		return Object.fromEntries(
			Object.entries(req.headers).map(([k, v]) => [
				k,
				Array.isArray(v) ? v.join(', ') : (v ?? ''),
			])
		);
	}

	async start(): Promise<void> {
		const { sdkVersion } = this;
		this.server = createHttpServer(async (req, res) => {
			// Extract trace context from headers
			const extractedContext = this.extractTraceContext(req);

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
								const payload = await this.getJSON<IncomingRequest>(req);
								const agentReq = {
									request: payload as IncomingRequest,
									url: req.url ?? '',
									headers: this.getHeaders(req),
								};
								const response = await route.handler(agentReq);
								res.writeHead(200, {
									'Content-Type': 'application/json',
									Server: `Agentuity NodeJS/${sdkVersion}`,
								});
								res.end(JSON.stringify(response));
								span.setStatus({ code: SpanStatusCode.OK });
							} catch (err) {
								this.logger.error('Server error', err);
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

	/**
	 * Extract trace context from incoming request headers
	 */
	private extractTraceContext(req: IncomingMessage) {
		// Create a carrier object from the headers
		const carrier: Record<string, string> = {};

		// Convert headers to the format expected by the propagator
		Object.entries(req.headers).forEach(([key, value]) => {
			if (typeof value === 'string') {
				carrier[key] = value;
			} else if (Array.isArray(value)) {
				carrier[key] = value[0] || '';
			}
		});

		// Extract the context using the global propagator
		const activeContext = context.active();
		return propagation.extract(activeContext, carrier);
	}
}
