import { describe, expect, it, mock, beforeEach } from 'bun:test';
import KeyValueAPI from '../../src/apis/keyvalue';
import '../setup'; // Import global test setup

describe('KeyValue API Compression', () => {
	let keyValueAPI: KeyValueAPI;
	let mockGzipBuffer: ReturnType<typeof mock>;
	let mockPUT: ReturnType<typeof mock>;
	let mockGET: ReturnType<typeof mock>;

	beforeEach(() => {
		keyValueAPI = new KeyValueAPI();

		mockGzipBuffer = mock((data: string) => {
			return Promise.resolve(Buffer.from(`compressed:${data}`));
		});

		mockPUT = mock(
			(_url: string, _data: unknown, _headers: Record<string, string>) => {
				return Promise.resolve({
					status: 201,
					response: {
						status: 201,
						statusText: 'Created',
					},
				});
			}
		);

		mockGET = mock((_url: string, _auth: boolean) => {
			return Promise.resolve({
				status: 200,
				headers: {
					get: (name: string) =>
						name === 'content-type' ? 'application/json' : null,
				},
				response: {
					arrayBuffer: () =>
						Promise.resolve(Buffer.from(JSON.stringify({ test: 'data' }))),
				},
			});
		});

		mock.module('../../src/server/gzip', () => ({
			gzipBuffer: mockGzipBuffer,
		}));

		mock.module('../../src/apis/api', () => ({
			PUT: mockPUT,
			GET: mockGET,
			DELETE: mock(() =>
				Promise.resolve({ status: 200, response: { status: 200 } })
			),
		}));

		mock.module('../../src/router/router', () => ({
			getTracer: () => ({
				startSpan: () => ({
					setAttribute: () => {},
					addEvent: () => {},
					setStatus: () => {},
					end: () => {},
				}),
			}),
			recordException: () => {},
		}));

		mock.module('@opentelemetry/api', () => ({
			context: {
				active: () => ({}),
				with: (_ctx: unknown, fn: () => unknown) => fn(),
			},
			trace: {
				setSpan: () => ({}),
			},
			SpanStatusCode: {
				OK: 'ok',
			},
		}));
	});

	describe('set method with compression', () => {
		it('should compress text data', async () => {
			const name = 'test-storage';
			const key = 'test-key';
			const value = 'This is a test string that should be compressed';

			await keyValueAPI.set(name, key, value);

			expect(mockGzipBuffer).toHaveBeenCalled();

			expect(mockPUT).toHaveBeenCalled();
			const putArgs = mockPUT.mock.calls[0];
			expect(putArgs[0]).toContain(encodeURIComponent(name));
			expect(putArgs[0]).toContain(encodeURIComponent(key));
			expect(putArgs[2]['Content-Encoding']).toBe('gzip');
		});

		it('should compress JSON data', async () => {
			const name = 'test-storage';
			const key = 'test-key';
			const value = { test: 'data', nested: { value: 123 } };

			await keyValueAPI.set(name, key, value);

			expect(mockGzipBuffer).toHaveBeenCalled();

			expect(mockPUT).toHaveBeenCalled();
			const putArgs = mockPUT.mock.calls[0];
			expect(putArgs[2]['Content-Encoding']).toBe('gzip');
			expect(putArgs[2]['Content-Type']).toBe('application/json');
		});

		it('should not compress binary data', async () => {
			const name = 'test-storage';
			const key = 'test-key';
			const value = new Uint8Array([1, 2, 3, 4]);

			await keyValueAPI.set(name, key, value);

			expect(mockGzipBuffer).not.toHaveBeenCalled();

			expect(mockPUT).toHaveBeenCalled();
			const putArgs = mockPUT.mock.calls[0];
			expect(putArgs[2]['Content-Encoding']).toBeUndefined();
		});

		it('should include TTL when provided', async () => {
			const name = 'test-storage';
			const key = 'test-key';
			const value = 'Test with TTL';
			const ttl = 3600; // 1 hour

			await keyValueAPI.set(name, key, value, { ttl });

			expect(mockPUT).toHaveBeenCalled();
			const putArgs = mockPUT.mock.calls[0];
			expect(putArgs[0]).toContain(`/${ttl}`);
		});

		it('should throw error for TTL less than 60 seconds', async () => {
			const name = 'test-storage';
			const key = 'test-key';
			const value = 'Test with invalid TTL';
			const ttl = 30; // Less than minimum

			await expect(
				keyValueAPI.set(name, key, value, { ttl })
			).rejects.toThrow();
		});
	});

	describe('get method with decompression', () => {
		it('should handle compressed responses', async () => {
			mockGET = mock(() =>
				Promise.resolve({
					status: 200,
					headers: {
						get: (name: string) => {
							if (name === 'content-type') return 'application/json';
							if (name === 'content-encoding') return 'gzip';
							return null;
						},
					},
					response: {
						arrayBuffer: () =>
							Promise.resolve(
								Buffer.from(
									'H4sICGUADWgAA3Rlc3QudHh0APPI5AIAmjwi1QMAAAA=',
									'base64'
								)
							),
					},
				})
			);

			mock.module('../../src/apis/api', () => ({
				GET: mockGET,
				PUT: mockPUT,
				DELETE: mock(() =>
					Promise.resolve({ status: 200, response: { status: 200 } })
				),
			}));

			const name = 'test-storage';
			const key = 'test-key';

			const result = await keyValueAPI.get(name, key);

			expect(result.exists).toBe(true);
			expect(mockGET).toHaveBeenCalled();
			const getArgs = mockGET.mock.calls[0];
			expect(getArgs[0]).toContain(encodeURIComponent(name));
			expect(getArgs[0]).toContain(encodeURIComponent(key));
		});
	});
});
