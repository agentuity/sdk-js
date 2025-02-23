import type { Server, UnifiedServerConfig, ServerRoute } from './types';
import type { AgentRequestType } from '../types';
export class BunServer implements Server {
	private server: ReturnType<typeof Bun.serve> | null = null;
	private config: UnifiedServerConfig;

	constructor(config: UnifiedServerConfig) {
		this.config = config;
	}

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

		const logger = this.config.logger;

		this.server = Bun.serve({
			port: this.config.port,
			async fetch(req) {
				const url = new URL(req.url);
				const method = req.method;
				const routeKey = `${method}:${url.pathname}`;

				logger.debug('request: %s %s', method, url.pathname);

				const route = routeMap.get(routeKey);

				if (!route) {
					return new Response('Not Found', { status: 404 });
				}

				try {
					const body = await req.json();
					const resp = await route.handler({
						url: req.url,
						request: body as AgentRequestType,
					});
					return new Response(JSON.stringify(resp), {
						headers: {
							'Content-Type': 'application/json',
						},
					});
				} catch (error) {
					logger.error('Error handling request:', error);
					return new Response('Internal Server Error', { status: 500 });
				}
			},
		});

		this.config.logger.info('Bun server started on port %d', this.config.port);
	}

	async stop(): Promise<void> {
		if (!this.server) {
			return;
		}
		this.config.logger.debug('server stopping');

		await this.server.stop();
		this.server = null;
		this.config.logger.info('server stopped');
	}
}
