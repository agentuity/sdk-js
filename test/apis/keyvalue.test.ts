import { describe, expect, it, mock, beforeEach } from 'bun:test';
import KeyValueAPI from '../../src/apis/keyvalue';
import type {
	Data,
	DataResult,
	DataResultFound,
	DataResultNotFound,
	ReadableDataType,
} from '../../src/types';
import type { ReadableStream } from 'node:stream/web';
import '../setup'; // Import global test setup
import { DataHandler } from '../../src/router/data';

describe('KeyValueAPI', () => {
	let keyValueAPI: KeyValueAPI;

	const mockTracer = {
		startSpan: mock((name: string, options: unknown, ctx: unknown) => {
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
		keyValueAPI = new KeyValueAPI();

		mock.module('@opentelemetry/api', () => ({
			context: {
				active: () => ({}),
			},
			trace: {
				setSpan: (ctx: unknown, span: unknown) => ctx,
				getTracer: () => mockTracer,
			},
			SpanStatusCode: {
				OK: 1,
				ERROR: 2,
			},
		}));

		mock.module('../../src/router/router', () => ({
			getTracer: () => mockTracer,
			recordException: mock(() => {}),
			asyncStorage: {
				getStore: () => ({
					tracer: mockTracer,
				}),
			},
		}));
	});

	describe('get', () => {
		it('should retrieve a value successfully', async () => {
			const mockResponse = {
				status: 200,
				headers: {
					get: (name: string) => 'application/json',
				},
				response: {
					arrayBuffer: () => new ArrayBuffer(8),
					statusText: 'OK',
				},
			};

			mock.module('../../src/apis/api', () => ({
				GET: mock(() => Promise.resolve(mockResponse)),
			}));

			keyValueAPI.get = async (
				name: string,
				key: string
			): Promise<DataResult> => {
				const result: DataResultFound = {
					exists: true,
					data: new DataHandler({
						contentType: 'application/json',
						payload: Buffer.from(JSON.stringify({ test: 'data' })).toString(
							'base64'
						),
					}),
				};
				return result;
			};

			const result = await keyValueAPI.get('test-store', 'test-key');

			expect(result.exists).toBe(true);
			if (result.exists) {
				expect(result.data).toBeDefined();
			}
		});

		it('should return not found when key is not found', async () => {
			const mockResponse = {
				status: 404,
			};

			mock.module('../../src/apis/api', () => ({
				GET: mock(() => Promise.resolve(mockResponse)),
			}));

			keyValueAPI.get = async (
				name: string,
				key: string
			): Promise<DataResult> => {
				const result: DataResultNotFound = {
					exists: false,
					data: undefined as never,
				};
				return result;
			};

			const result = await keyValueAPI.get('test-store', 'not-found-key');

			expect(result.exists).toBe(false);
		});

		it('should throw an error on failed request', async () => {
			const mockResponse = {
				status: 500,
				response: {
					statusText: 'Internal Server Error',
					status: 500,
				},
			};

			mock.module('../../src/apis/api', () => ({
				GET: mock(() => Promise.resolve(mockResponse)),
			}));

			keyValueAPI.get = async (
				name: string,
				key: string
			): Promise<DataResult> => {
				throw new Error('Internal Server Error');
			};

			await expect(keyValueAPI.get('test-store', 'test-key')).rejects.toThrow();
		});
	});
});
