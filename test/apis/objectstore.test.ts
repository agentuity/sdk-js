import { describe, expect, it, mock, beforeEach } from 'bun:test';
import ObjectStoreAPI from '../../src/apis/objectstore';
import '../setup'; // Import global test setup
import { DataHandler } from '../../src/router/data';

describe('ObjectStore API', () => {
	let objectStore: ObjectStoreAPI;

	const mockTracer = {
		startSpan: mock((_name: string, _options: unknown, _ctx: unknown) => {
			return {
				setAttribute: mock(() => {}),
				addEvent: mock(() => {}),
				end: mock(() => {}),
				setStatus: mock(() => {}),
				recordException: mock(() => {}),
			};
		}),
	};

	beforeEach(() => {
		mock.restore();
		objectStore = new ObjectStoreAPI();

		mock.module('@opentelemetry/api', () => ({
			context: {
				active: () => ({}),
				with: (_ctx: unknown, fn: () => Promise<unknown>) => fn(),
			},
			trace: {
				setSpan: (ctx: unknown, _span: unknown) => ctx,
			},
			SpanStatusCode: {
				OK: 1,
				ERROR: 2,
			},
		}));

		mock.module('../../src/router/router', () => ({
			getTracer: () => mockTracer,
			recordException: mock(() => {}),
		}));
	});

	describe('get', () => {
		it('should return data when object exists', async () => {
			const mockResponse = {
				status: 200,
				headers: {
					get: (_name: string) => 'text/plain',
				},
				response: {
					arrayBuffer: () => Promise.resolve(Buffer.from('test data').buffer),
					statusText: 'OK',
				},
			};

			mock.module('../../src/apis/api', () => ({
				GET: mock(() => Promise.resolve(mockResponse)),
			}));

			const result = await objectStore.get('test-bucket', 'test-key');

			expect(result.exists).toBe(true);
			if (result.exists) {
				expect(await result.data.text()).toBe('test data');
				expect(result.data.contentType).toBe('text/plain');
			}
		});

		it('should return not found when object does not exist', async () => {
			const mockResponse = {
				status: 404,
			};

			mock.module('../../src/apis/api', () => ({
				GET: mock(() => Promise.resolve(mockResponse)),
			}));

			const result = await objectStore.get('test-bucket', 'nonexistent-key');

			expect(result.exists).toBe(false);
		});

		it('should throw error with text message for other status codes', async () => {
			const mockResponse = {
				status: 500,
				response: {
					text: () => Promise.resolve('Internal server error'),
					statusText: 'Internal Server Error',
				},
			};

			mock.module('../../src/apis/api', () => ({
				GET: mock(() => Promise.resolve(mockResponse)),
			}));

			await expect(objectStore.get('test-bucket', 'test-key')).rejects.toThrow(
				'Internal server error'
			);
		});
	});

	describe('put', () => {
		it('should successfully put an object', async () => {
			const mockResponse = {
				status: 200,
			};

			mock.module('../../src/apis/api', () => ({
				PUT: mock(() => Promise.resolve(mockResponse)),
			}));

			mock.module('../../src/server/util', () => ({
				fromDataType: mock(() =>
					Promise.resolve({
						data: new DataHandler('test data', 'text/plain'),
					})
				),
			}));

			mock.module('../../src/types', () => ({
				isDataType: mock(() => true),
			}));

			await expect(
				objectStore.put('test-bucket', 'test-key', 'test data')
			).resolves.toBeUndefined();
		});

		it('should throw error for invalid data type', async () => {
			// Create a fresh ObjectStore instance for this test to avoid mock interference
			const freshObjectStore = new ObjectStoreAPI();

			mock.module('../../src/types', () => ({
				isDataType: mock(() => false),
			}));

			await expect(
				freshObjectStore.put(
					'test-bucket',
					'test-key',
					Symbol('invalid') as unknown
				)
			).rejects.toThrow('data must be a DataType');
		});

		it('should throw error with text message for non-200 status codes', async () => {
			const mockResponse = {
				status: 400,
				response: {
					text: () => Promise.resolve('Bad request: invalid bucket name'),
					statusText: 'Bad Request',
				},
			};

			mock.module('../../src/apis/api', () => ({
				PUT: mock(() => Promise.resolve(mockResponse)),
			}));

			mock.module('../../src/server/util', () => ({
				fromDataType: mock(() =>
					Promise.resolve({
						data: new DataHandler('test data', 'text/plain'),
					})
				),
			}));

			mock.module('../../src/types', () => ({
				isDataType: mock(() => true),
			}));

			await expect(
				objectStore.put('test-bucket', 'test-key', 'test data')
			).rejects.toThrow('Bad request: invalid bucket name');
		});
	});

	describe('delete', () => {
		it('should return true when object is deleted', async () => {
			const mockResponse = {
				status: 200,
			};

			mock.module('../../src/apis/api', () => ({
				DELETE: mock(() => Promise.resolve(mockResponse)),
			}));

			const result = await objectStore.delete('test-bucket', 'test-key');

			expect(result).toBe(true);
		});

		it('should return false when object does not exist', async () => {
			const mockResponse = {
				status: 404,
			};

			mock.module('../../src/apis/api', () => ({
				DELETE: mock(() => Promise.resolve(mockResponse)),
			}));

			const result = await objectStore.delete('test-bucket', 'nonexistent-key');

			expect(result).toBe(false);
		});

		it('should throw error with text message for other status codes', async () => {
			const mockResponse = {
				status: 403,
				response: {
					text: () => Promise.resolve('Access denied'),
					statusText: 'Forbidden',
				},
			};

			mock.module('../../src/apis/api', () => ({
				DELETE: mock(() => Promise.resolve(mockResponse)),
			}));

			await expect(
				objectStore.delete('test-bucket', 'test-key')
			).rejects.toThrow('Access denied');
		});
	});

	describe('createPublicURL', () => {
		it('should return a public URL', async () => {
			const mockUrl = 'https://example.com/public-url';
			const mockResponse = {
				status: 200,
				json: { success: true, url: mockUrl },
			};

			mock.module('../../src/apis/api', () => ({
				POST: mock(() => Promise.resolve(mockResponse)),
			}));

			const result = await objectStore.createPublicURL(
				'test-bucket',
				'test-key'
			);

			expect(result).toBe(mockUrl);
		});

		it('should send expires duration in JSON body', async () => {
			const mockUrl = 'https://example.com/public-url';
			const mockResponse = {
				status: 200,
				json: { success: true, url: mockUrl },
			};

			let capturedBody: string | undefined;
			mock.module('../../src/apis/api', () => ({
				POST: mock((_path: string, body: string) => {
					capturedBody = body;
					return Promise.resolve(mockResponse);
				}),
			}));

			const result = await objectStore.createPublicURL(
				'test-bucket',
				'test-key',
				3600000
			);

			expect(result).toBe(mockUrl);
			expect(capturedBody).toBe('{"expires":3600000}');
		});

		it('should send empty JSON body when no expires duration provided', async () => {
			const mockUrl = 'https://example.com/public-url';
			const mockResponse = {
				status: 200,
				json: { success: true, url: mockUrl },
			};

			let capturedBody: string | undefined;
			mock.module('../../src/apis/api', () => ({
				POST: mock((_path: string, body: string) => {
					capturedBody = body;
					return Promise.resolve(mockResponse);
				}),
			}));

			const result = await objectStore.createPublicURL(
				'test-bucket',
				'test-key'
			);

			expect(result).toBe(mockUrl);
			expect(capturedBody).toBe('{}');
		});
	});
});
