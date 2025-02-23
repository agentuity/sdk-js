import type {
	IncomingRequest,
	Server,
	ServerRoute,
	UnifiedServerConfig,
} from './types';
import type { Logger } from '../logger';
import { createServer as createHttpServer } from 'node:http';
import type { AgentRequestType } from '../types';

export class NodeServer implements Server {
	private readonly logger: Logger;
	private readonly port: number;
	private readonly routes: ServerRoute[];
	private server: ReturnType<typeof createHttpServer> | null = null;

	constructor({ logger, port, routes }: UnifiedServerConfig) {
		this.logger = logger;
		this.port = port;
		this.routes = routes;
	}

	async stop(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (this.server) {
				this.server.close((err?: Error | null) => {
					this.server = null;
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				});
			}
		});
	}

	async start(): Promise<void> {
		this.server = createHttpServer(async (req, res) => {
			try {
				if (req.url === '/_health') {
					res.writeHead(200);
					res.end();
					return;
				}
				const route = this.routes.find((r) => r.path === req.url);
				if (!route) {
					res.writeHead(404);
					res.end();
					return;
				}

				if (req.method !== route.method) {
					res.writeHead(405);
					res.end();
					return;
				}

				const chunks: Buffer[] = [];
				req.on('data', (chunk) => chunks.push(chunk));
				req.on('end', async () => {
					try {
						const body = Buffer.concat(chunks);
						const payload = JSON.parse(body.toString());
						const agentReq = {
							request: payload as IncomingRequest,
							url: req.url ?? '',
						};
						const response = await route.handler(agentReq);
						res.writeHead(200, {
							'Content-Type': 'application/json',
						});
						res.end(JSON.stringify(response));
					} catch (err) {
						this.logger.error('Error processing request', err);
						res.writeHead(500);
						res.end();
					}
				});
			} catch (err) {
				this.logger.error('Server error', err);
				res.writeHead(500);
				res.end();
			}
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
