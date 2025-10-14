import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test';
import {
	send,
	GET,
	POST,
	PUT,
	DELETE,
	setFetch,
	getFetch,
	getBaseUrlForService,
} from '../../src/apis/api';
import { createMockFetch } from '../setup';
import { ReadableStream } from 'node:stream/web';
import { context, ROOT_CONTEXT } from '@opentelemetry/api';

describe('API Client', () => {
	let originalEnv: NodeJS.ProcessEnv;
	let fetchCalls: Array<[URL | RequestInfo, RequestInit | undefined]>;
	let mockFetch: ReturnType<typeof mock>;
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		originalEnv = { ...process.env };
		process.env.AGENTUITY_API_KEY = 'test-api-key';
		process.env.AGENTUITY_SDK_KEY = 'test-api-key';
		process.env.AGENTUITY_TRANSPORT_URL = 'https://test.agentuity.ai/';

		const mockSetup = createMockFetch();
		fetchCalls = mockSetup.fetchCalls;
		mockFetch = mockSetup.mockFetch;

		setFetch(mockFetch as unknown as typeof fetch);

		// Mock the router module
		mock.module('../../src/router/router', () => ({
			getSDKVersion: () => '1.0.0',
		}));
	});

	afterEach(() => {
		process.env = originalEnv;
		mock.restore();
		fetchCalls.length = 0;
		setFetch(originalFetch);
	});

	describe('send', () => {
		it('should throw error if API key is not set', async () => {
			process.env.AGENTUITY_API_KEY = undefined;
			process.env.AGENTUITY_SDK_KEY = undefined;
			await expect(
				send({
					method: 'GET',
					path: '/test',
					body: undefined as never,
				})
			).rejects.toThrow('AGENTUITY_API_KEY or AGENTUITY_SDK_KEY is not set');
		});

		it('should send request with correct headers', async () => {
			process.env.AGENTUITY_SDK_KEY = undefined;
			await send({
				method: 'GET',
				path: '/test',
				body: undefined as never,
			});

			expect(fetchCalls.length).toBeGreaterThan(0);
			const [url, options] = fetchCalls[0];

			expect(url.toString()).toEqual('https://test.agentuity.ai/test');
			const headers = options?.headers as Record<string, string>;
			expect(headers?.Authorization).toEqual('Bearer test-api-key');
			expect(headers?.['User-Agent']).toEqual('Agentuity JS SDK/1.0.0');
		});

		it('should handle custom headers', async () => {
			await send({
				method: 'GET',
				path: '/test',
				body: undefined as never,
				headers: {
					'X-Custom-Header': 'custom-value',
				},
			});

			const [, options] = fetchCalls[0];
			const headers = options?.headers as Record<string, string>;
			expect(headers?.['X-Custom-Header']).toEqual('custom-value');
		});

		it('should retry on 429 status', async () => {
			fetchCalls.length = 0;

			let callCount = 0;

			const retryMockFetch = mock(
				(url: URL | RequestInfo, options?: RequestInit) => {
					fetchCalls.push([url, options]);
					callCount++;

					if (callCount === 1) {
						return Promise.resolve({
							status: 429,
							headers: new Headers(),
						});
					}

					return Promise.resolve({
						status: 200,
						headers: new Headers({
							'content-type': 'application/json',
						}),
						json: () => Promise.resolve({ success: true }),
					});
				}
			);

			setFetch(retryMockFetch as unknown as typeof fetch);

			const result = await send({
				method: 'GET',
				path: '/test',
				body: undefined as never,
			});

			expect(callCount).toBe(2);
			expect(result.status).toEqual(200);
			expect(result.json).toEqual({ success: true });
		});

		it('should parse JSON response', async () => {
			const result = await send({
				method: 'GET',
				path: '/test',
				body: undefined as never,
			});

			expect(result.json).toEqual({ success: true });
		});

		it('should not parse JSON when forceBuffer is true', async () => {
			const result = await send(
				{
					method: 'GET',
					path: '/test',
					body: undefined as never,
				},
				true
			);

			expect(result.json).toBeNull();
		});

		it('should set duplex to "half" when body is ReadableStream', async () => {
			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue('test data');
					controller.close();
				},
			});

			await send({
				method: 'POST',
				path: '/test',
				body: stream,
			});

			expect(fetchCalls.length).toBeGreaterThan(0);
			const [, options] = fetchCalls[0];
			expect(options?.duplex).toBe('half');
		});

		it('should not set duplex when body is not ReadableStream', async () => {
			await send({
				method: 'POST',
				path: '/test',
				body: 'string body',
			});

			expect(fetchCalls.length).toBeGreaterThan(0);
			const [, options] = fetchCalls[0];
			expect(options?.duplex).toBeUndefined();
		});

		it('should not set duplex when body is Blob', async () => {
			const blob = new Blob(['test data'], { type: 'text/plain' });

			await send({
				method: 'POST',
				path: '/test',
				body: blob,
			});

			expect(fetchCalls.length).toBeGreaterThan(0);
			const [, options] = fetchCalls[0];
			expect(options?.duplex).toBeUndefined();
		});

		it('should not set duplex when body is FormData', async () => {
			const formData = new FormData();
			formData.append('key', 'value');

			await send({
				method: 'POST',
				path: '/test',
				body: formData,
			});

			expect(fetchCalls.length).toBeGreaterThan(0);
			const [, options] = fetchCalls[0];
			expect(options?.duplex).toBeUndefined();
		});
	});

	describe('HTTP methods', () => {
		it('should send GET request', async () => {
			await GET('/test');

			expect(fetchCalls.length).toBeGreaterThan(0);
			const [url, options] = fetchCalls[0];
			expect(options?.method).toEqual('GET');
			expect(url.toString()).toContain('/test');
		});

		it('should send POST request with body', async () => {
			const body = JSON.stringify({ test: 'data' });
			await POST('/test', body);

			const [, options] = fetchCalls[0];
			expect(options?.method).toEqual('POST');
			expect(options?.body).toEqual(body);
		});

		it('should send PUT request with body', async () => {
			const body = JSON.stringify({ test: 'data' });
			await PUT('/test', body);

			const [, options] = fetchCalls[0];
			expect(options?.method).toEqual('PUT');
			expect(options?.body).toEqual(body);
		});

		it('should send DELETE request', async () => {
			await DELETE('/test');

			const [, options] = fetchCalls[0];
			expect(options?.method).toEqual('DELETE');
		});

		it('should send DELETE request with body', async () => {
			const body = JSON.stringify({ test: 'data' });
			await DELETE('/test', body);

			const [, options] = fetchCalls[0];
			expect(options?.method).toEqual('DELETE');
			expect(options?.body).toEqual(body);
		});
	});

	describe('getBaseUrlForService', () => {
		beforeEach(() => {
			// Clear all service-specific environment variables
			delete process.env.AGENTUITY_VECTOR_URL;
			delete process.env.AGENTUITY_KEYVALUE_URL;
			delete process.env.AGENTUITY_STREAM_URL;
			delete process.env.AGENTUITY_OBJECTSTORE_URL;
			delete process.env.AGENTUITY_TRANSPORT_URL;
		});

		it('should return default URL when no environment variables are set', () => {
			expect(getBaseUrlForService()).toBe('https://agentuity.ai/');
			expect(getBaseUrlForService('vector')).toBe('https://agentuity.ai/');
			expect(getBaseUrlForService('keyvalue')).toBe('https://agentuity.ai/');
			expect(getBaseUrlForService('stream')).toBe(
				'https://streams.agentuity.cloud'
			);
			expect(getBaseUrlForService('objectstore')).toBe('https://agentuity.ai/');
		});

		it('should use AGENTUITY_TRANSPORT_URL as fallback', () => {
			process.env.AGENTUITY_TRANSPORT_URL = 'https://transport.example.com/';

			expect(getBaseUrlForService()).toBe('https://transport.example.com/');
			expect(getBaseUrlForService('vector')).toBe(
				'https://transport.example.com/'
			);
			expect(getBaseUrlForService('keyvalue')).toBe(
				'https://transport.example.com/'
			);
			expect(getBaseUrlForService('stream')).toBe(
				'https://streams.agentuity.cloud'
			); // Stream service has its own default
			expect(getBaseUrlForService('objectstore')).toBe(
				'https://transport.example.com/'
			);
		});

		it('should use service-specific URL for vector service', () => {
			process.env.AGENTUITY_TRANSPORT_URL = 'https://transport.example.com/';
			process.env.AGENTUITY_VECTOR_URL = 'https://vector.example.com/';

			expect(getBaseUrlForService('vector')).toBe(
				'https://vector.example.com/'
			);
			// Other services should still use transport URL
			expect(getBaseUrlForService('keyvalue')).toBe(
				'https://transport.example.com/'
			);
		});

		it('should use service-specific URL for keyvalue service', () => {
			process.env.AGENTUITY_TRANSPORT_URL = 'https://transport.example.com/';
			process.env.AGENTUITY_KEYVALUE_URL = 'https://keyvalue.example.com/';

			expect(getBaseUrlForService('keyvalue')).toBe(
				'https://keyvalue.example.com/'
			);
			// Other services should still use transport URL
			expect(getBaseUrlForService('vector')).toBe(
				'https://transport.example.com/'
			);
		});

		it('should use service-specific URL for stream service', () => {
			process.env.AGENTUITY_TRANSPORT_URL = 'https://transport.example.com/';
			process.env.AGENTUITY_STREAM_URL = 'https://stream.example.com/';

			expect(getBaseUrlForService('stream')).toBe(
				'https://stream.example.com/'
			);
			// Other services should still use transport URL
			expect(getBaseUrlForService('vector')).toBe(
				'https://transport.example.com/'
			);
		});

		it('should use service-specific URL for objectstore service', () => {
			process.env.AGENTUITY_TRANSPORT_URL = 'https://transport.example.com/';
			process.env.AGENTUITY_OBJECTSTORE_URL =
				'https://objectstore.example.com/';

			expect(getBaseUrlForService('objectstore')).toBe(
				'https://objectstore.example.com/'
			);
			// Other services should still use transport URL
			expect(getBaseUrlForService('vector')).toBe(
				'https://transport.example.com/'
			);
		});

		it('should prioritize service-specific URLs over transport URL', () => {
			process.env.AGENTUITY_TRANSPORT_URL = 'https://transport.example.com/';
			process.env.AGENTUITY_VECTOR_URL = 'https://vector.example.com/';
			process.env.AGENTUITY_KEYVALUE_URL = 'https://keyvalue.example.com/';
			process.env.AGENTUITY_STREAM_URL = 'https://stream.example.com/';
			process.env.AGENTUITY_OBJECTSTORE_URL =
				'https://objectstore.example.com/';

			expect(getBaseUrlForService('vector')).toBe(
				'https://vector.example.com/'
			);
			expect(getBaseUrlForService('keyvalue')).toBe(
				'https://keyvalue.example.com/'
			);
			expect(getBaseUrlForService('stream')).toBe(
				'https://stream.example.com/'
			);
			expect(getBaseUrlForService('objectstore')).toBe(
				'https://objectstore.example.com/'
			);
		});

		it('should handle undefined service parameter', () => {
			process.env.AGENTUITY_TRANSPORT_URL = 'https://transport.example.com/';
			expect(getBaseUrlForService(undefined)).toBe(
				'https://transport.example.com/'
			);
		});
	});

	describe('HTTP methods with service parameter', () => {
		beforeEach(() => {
			process.env.AGENTUITY_TRANSPORT_URL = 'https://transport.example.com/';
			process.env.AGENTUITY_VECTOR_URL = 'https://vector.example.com/';
			process.env.AGENTUITY_KEYVALUE_URL = 'https://keyvalue.example.com/';
			process.env.AGENTUITY_STREAM_URL = 'https://stream.example.com/';
			process.env.AGENTUITY_OBJECTSTORE_URL =
				'https://objectstore.example.com/';
		});

		it('should use vector service URL for GET request', async () => {
			await GET('/test', false, undefined, undefined, undefined, 'vector');

			expect(fetchCalls.length).toBeGreaterThan(0);
			const [url] = fetchCalls[0];
			expect(url.toString()).toBe('https://vector.example.com/test');
		});

		it('should use keyvalue service URL for POST request', async () => {
			await POST(
				'/test',
				JSON.stringify({ data: 'test' }),
				undefined,
				undefined,
				undefined,
				'keyvalue'
			);

			expect(fetchCalls.length).toBeGreaterThan(0);
			const [url] = fetchCalls[0];
			expect(url.toString()).toBe('https://keyvalue.example.com/test');
		});

		it('should use stream service URL for PUT request', async () => {
			await PUT(
				'/test',
				JSON.stringify({ data: 'test' }),
				undefined,
				undefined,
				undefined,
				'stream'
			);

			expect(fetchCalls.length).toBeGreaterThan(0);
			const [url] = fetchCalls[0];
			expect(url.toString()).toBe('https://stream.example.com/test');
		});

		it('should use objectstore service URL for DELETE request', async () => {
			await DELETE(
				'/test',
				undefined,
				undefined,
				undefined,
				undefined,
				'objectstore'
			);

			expect(fetchCalls.length).toBeGreaterThan(0);
			const [url] = fetchCalls[0];
			expect(url.toString()).toBe('https://objectstore.example.com/test');
		});

		it('should use transport URL when no service is specified', async () => {
			await GET('/test');

			expect(fetchCalls.length).toBeGreaterThan(0);
			const [url] = fetchCalls[0];
			expect(url.toString()).toBe('https://transport.example.com/test');
		});

		it('should use transport URL as fallback when service-specific URL is not set', async () => {
			delete process.env.AGENTUITY_VECTOR_URL;

			await GET('/test', false, undefined, undefined, undefined, 'vector');

			expect(fetchCalls.length).toBeGreaterThan(0);
			const [url] = fetchCalls[0];
			expect(url.toString()).toBe('https://transport.example.com/test');
		});

		it('should handle POST request with auth token and service', async () => {
			await POST(
				'/test',
				JSON.stringify({ data: 'test' }),
				undefined,
				undefined,
				'custom-token',
				'vector'
			);

			expect(fetchCalls.length).toBeGreaterThan(0);
			const [url, options] = fetchCalls[0];
			expect(url.toString()).toBe('https://vector.example.com/test');

			const headers = options?.headers as Record<string, string>;
			expect(headers?.Authorization).toBe('Bearer custom-token');
		});

		it('should handle GET request with auth token and service', async () => {
			await GET(
				'/test',
				false,
				undefined,
				undefined,
				'get-custom-token',
				'keyvalue'
			);

			expect(fetchCalls.length).toBeGreaterThan(0);
			const [url, options] = fetchCalls[0];
			expect(url.toString()).toBe('https://keyvalue.example.com/test');

			const headers = options?.headers as Record<string, string>;
			expect(headers?.Authorization).toBe('Bearer get-custom-token');
		});

		it('should handle PUT request with auth token and service', async () => {
			await PUT(
				'/test',
				JSON.stringify({ data: 'test' }),
				undefined,
				undefined,
				'put-custom-token',
				'stream'
			);

			expect(fetchCalls.length).toBeGreaterThan(0);
			const [url, options] = fetchCalls[0];
			expect(url.toString()).toBe('https://stream.example.com/test');

			const headers = options?.headers as Record<string, string>;
			expect(headers?.Authorization).toBe('Bearer put-custom-token');
		});

		it('should handle DELETE request with auth token and service', async () => {
			await DELETE(
				'/test',
				undefined,
				undefined,
				undefined,
				'delete-custom-token',
				'objectstore'
			);

			expect(fetchCalls.length).toBeGreaterThan(0);
			const [url, options] = fetchCalls[0];
			expect(url.toString()).toBe('https://objectstore.example.com/test');

			const headers = options?.headers as Record<string, string>;
			expect(headers?.Authorization).toBe('Bearer delete-custom-token');
		});

		it('should validate all services work correctly', async () => {
			const services: Array<{
				name: 'vector' | 'keyvalue' | 'stream' | 'objectstore';
				expectedUrl: string;
			}> = [
				{ name: 'vector', expectedUrl: 'https://vector.example.com/test' },
				{ name: 'keyvalue', expectedUrl: 'https://keyvalue.example.com/test' },
				{ name: 'stream', expectedUrl: 'https://stream.example.com/test' },
				{
					name: 'objectstore',
					expectedUrl: 'https://objectstore.example.com/test',
				},
			];

			for (const service of services) {
				fetchCalls.length = 0; // Clear previous calls
				await GET(
					'/test',
					false,
					undefined,
					undefined,
					undefined,
					service.name
				);

				expect(fetchCalls.length).toBeGreaterThan(0);
				const [url] = fetchCalls[0];
				expect(url.toString()).toBe(service.expectedUrl);
			}
		});
	});

	describe('Service URL priority integration tests', () => {
		it('should migrate correctly from transport URL to service-specific URLs', async () => {
			// Start with only transport URL (legacy setup)
			process.env.AGENTUITY_TRANSPORT_URL = 'https://legacy.agentuity.ai/';
			delete process.env.AGENTUITY_VECTOR_URL;

			await GET('/vectors', false, undefined, undefined, undefined, 'vector');
			let [url] = fetchCalls[0];
			expect(url.toString()).toBe('https://legacy.agentuity.ai/vectors');

			// Add vector-specific URL (migration)
			fetchCalls.length = 0;
			process.env.AGENTUITY_VECTOR_URL = 'https://vector.agentuity.ai/';

			await GET('/vectors', false, undefined, undefined, undefined, 'vector');
			[url] = fetchCalls[0];
			expect(url.toString()).toBe('https://vector.agentuity.ai/vectors');
		});

		it('should handle mixed service configurations', async () => {
			// Some services have specific URLs, others use transport URL
			process.env.AGENTUITY_TRANSPORT_URL = 'https://transport.agentuity.ai/';
			process.env.AGENTUITY_VECTOR_URL = 'https://vector.agentuity.ai/';
			delete process.env.AGENTUITY_KEYVALUE_URL;
			process.env.AGENTUITY_STREAM_URL = 'https://stream.agentuity.ai/';
			delete process.env.AGENTUITY_OBJECTSTORE_URL;

			const testCases = [
				{
					service: 'vector' as const,
					expectedUrl: 'https://vector.agentuity.ai/test',
				},
				{
					service: 'keyvalue' as const,
					expectedUrl: 'https://transport.agentuity.ai/test',
				},
				{
					service: 'stream' as const,
					expectedUrl: 'https://stream.agentuity.ai/test',
				},
				{
					service: 'objectstore' as const,
					expectedUrl: 'https://transport.agentuity.ai/test',
				},
			];

			for (const testCase of testCases) {
				fetchCalls.length = 0;
				await GET(
					'/test',
					false,
					undefined,
					undefined,
					undefined,
					testCase.service
				);

				expect(fetchCalls.length).toBeGreaterThan(0);
				const [url] = fetchCalls[0];
				expect(url.toString()).toBe(testCase.expectedUrl);
			}
		});
	});

	describe('getFetch', () => {
		it('should return the currently set fetch function', () => {
			const originalFetch = getFetch();

			const mockFetch = mock(() => Promise.resolve({} as Response));
			setFetch(mockFetch as unknown as typeof fetch);

			expect(getFetch()).toBe(mockFetch);

			// Restore original
			setFetch(originalFetch);
		});

		it('should return globalThis.fetch by default', () => {
			// Reset to default
			setFetch(globalThis.fetch);
			expect(getFetch()).toBe(globalThis.fetch);
		});
	});

	describe('OpenTelemetry trace context propagation', () => {
		it('should pass through traceparent header when provided', async () => {
			const traceparent =
				'00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

			await send({
				method: 'GET',
				path: '/test',
				body: undefined as never,
				headers: {
					traceparent,
				},
			});

			expect(fetchCalls.length).toBeGreaterThan(0);
			const [, options] = fetchCalls[0];
			const headers = options?.headers as Record<string, string>;

			expect(headers?.traceparent).toBe(traceparent);
		});

		it('should not inject traceparent header when there is no active context', async () => {
			await context.with(ROOT_CONTEXT, async () => {
				await send({
					method: 'GET',
					path: '/test',
					body: undefined as never,
				});

				expect(fetchCalls.length).toBeGreaterThan(0);
				const [, options] = fetchCalls[0];
				const headers = options?.headers as Record<string, string>;

				expect(headers?.traceparent).toBeUndefined();
			});
		});

		it('should preserve existing trace headers passed in request', async () => {
			const existingTraceparent =
				'00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

			await send({
				method: 'POST',
				path: '/test',
				body: JSON.stringify({ test: 'data' }),
				headers: {
					traceparent: existingTraceparent,
				},
			});

			expect(fetchCalls.length).toBeGreaterThan(0);
			const [, options] = fetchCalls[0];
			const headers = options?.headers as Record<string, string>;

			expect(headers?.traceparent).toBe(existingTraceparent);
		});

		it('should preserve custom headers when traceparent is included', async () => {
			const traceparent =
				'00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

			await send({
				method: 'GET',
				path: '/test',
				body: undefined as never,
				headers: {
					traceparent,
					'X-Custom-Header': 'custom-value',
					'X-Another-Header': 'another-value',
				},
			});

			expect(fetchCalls.length).toBeGreaterThan(0);
			const [, options] = fetchCalls[0];
			const headers = options?.headers as Record<string, string>;

			expect(headers?.traceparent).toBe(traceparent);
			expect(headers?.['X-Custom-Header']).toBe('custom-value');
			expect(headers?.['X-Another-Header']).toBe('another-value');
			expect(headers?.Authorization).toBe('Bearer test-api-key');
		});
	});
});
