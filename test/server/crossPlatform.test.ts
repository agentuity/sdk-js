import { describe, expect, it, mock } from 'bun:test';
import AgentResolver from '../../src/server/agents';
import { ReadableStream } from 'node:stream/web';
import '../setup'; // Import global test setup
import { mockOpenTelemetry } from '../mocks/opentelemetry';
import * as router from '../../src/router/router';

// Mock the router module to prevent "no store" error
mock.module('../../src/router/router', () => {
	return {
		...router,
		getTracer: () => ({
			startSpan: () => ({
				end: () => {},
				setAttribute: () => {},
				setStatus: () => {},
				recordException: () => {},
			}),
		}),
		recordException: () => {},
		getSDKVersion: () => 'test',
	};
});

// Setup OpenTelemetry mocks
mockOpenTelemetry();

describe('Cross-platform compatibility', () => {
	const mockLogger = {
		debug: mock(() => {}),
		info: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
		child: mock(() => mockLogger),
	};

	let originalFetch: typeof globalThis.fetch;
	let mockResponseBody: ReadableStream;

	it('should handle headers object without toJSON method', async () => {
		// Save the original fetch
		originalFetch = globalThis.fetch;

		try {
			// Create a mock response body
			mockResponseBody = new ReadableStream({
				start(controller) {
					const encoder = new TextEncoder();
					controller.enqueue(
						encoder.encode(JSON.stringify({ message: 'Hello from agent' }))
					);
					controller.close();
				},
			});

			// Create a mock Headers implementation without toJSON method
			// Using a plain object that mimics Headers API but without toJSON
			const mockHeaders = {
				get: (name: string) => {
					if (name.toLowerCase() === 'content-type') return 'application/json';
					if (name.toLowerCase() === 'x-agentuity-responseid') return '12345';
					return null;
				},
				has: (name: string) => {
					return (
						name.toLowerCase() === 'content-type' ||
						name.toLowerCase() === 'x-agentuity-responseid'
					);
				},
				forEach: (callback: (value: string, key: string) => void) => {
					callback('application/json', 'content-type');
					callback('12345', 'x-agentuity-responseid');
				},
				// Intentionally no toJSON method
			};

			// Ensure toJSON is really not available
			expect('toJSON' in mockHeaders).toBe(false);

			// Create a selective mock fetch that only intercepts requests to our agent
			// This way, other tests that might run in parallel won't be affected
			globalThis.fetch = mock(
				(url: string | URL | Request, init?: RequestInit) => {
					// Convert url to string if it's not already
					const urlString =
						url instanceof URL
							? url.toString()
							: url instanceof Request
								? url.url
								: url;

					// Only intercept requests to our test agent
					if (urlString.includes('test-agent-id')) {
						return Promise.resolve({
							ok: true,
							status: 200,
							statusText: 'OK',
							headers: mockHeaders,
							body: mockResponseBody,
						} as Response);
					}

					// For all other URLs, use the original fetch
					return originalFetch(url, init);
				}
			);

			const agents = [
				{
					id: 'test-agent-id',
					name: 'Test Agent',
					filename: 'agent-path',
					description: 'Test Agent description',
				},
			];

			const resolver = new AgentResolver(
				mockLogger,
				agents,
				3000,
				'project-id',
				'current-agent-id'
			);

			// Get the agent
			const agent = await resolver.getAgent({ id: 'test-agent-id' });

			// Run the agent - this would fail before our fix
			const response = await agent.run({
				data: 'Test input data',
				contentType: 'text/plain',
			});

			// Verify data content
			const jsonData = await response.data.json();
			expect(jsonData).toEqual({ message: 'Hello from agent' });
		} finally {
			// Always restore the original fetch, even if the test fails
			globalThis.fetch = originalFetch;
		}
	});
});
