import { describe, expect, it, mock, beforeEach } from 'bun:test';
import VectorAPI from '../../src/apis/vector';
import type { VectorSearchResult } from '../../src/types';
import '../setup'; // Import global test setup

describe('VectorAPI', () => {
	let vectorAPI: VectorAPI;
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
		vectorAPI = new VectorAPI();

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

	describe('search', () => {
		it('should return search results successfully', async () => {
			const mockSearchResults: VectorSearchResult[] = [
				{ id: '1', key: 'key1', metadata: { name: 'test' }, similarity: 0.95 },
			];
			const mockResponse = {
				status: 200,
				json: {
					success: true,
					data: mockSearchResults,
				},
			};

			mock.module('../../src/apis/api', () => ({
				POST: mock(() => Promise.resolve(mockResponse)),
			}));

			const originalSearch = vectorAPI.search;
			vectorAPI.search = async (
				name: string,
				params: unknown
			): Promise<VectorSearchResult[]> => mockSearchResults;

			const searchParams = { query: 'test query' };
			const results = await vectorAPI.search('test-store', searchParams);

			expect(results).toEqual(mockSearchResults);

			vectorAPI.search = originalSearch;
		});

		it('should return empty array when no results found', async () => {
			const mockResponse = {
				status: 404,
			};

			mock.module('../../src/apis/api', () => ({
				POST: mock(() => Promise.resolve(mockResponse)),
			}));

			const originalSearch = vectorAPI.search;
			vectorAPI.search = async (
				name: string,
				params: unknown
			): Promise<VectorSearchResult[]> => [];

			const searchParams = { query: 'not found query' };
			const results = await vectorAPI.search('test-store', searchParams);

			expect(results).toEqual([]);

			vectorAPI.search = originalSearch;
		});
	});

	describe('delete', () => {
		it('should delete a single vector successfully', async () => {
			const mockResponse = {
				status: 200,
				json: {
					success: true,
					data: 1,
				},
			};

			mock.module('../../src/apis/api', () => ({
				DELETE: mock(() => Promise.resolve(mockResponse)),
			}));

			const originalDelete = vectorAPI.delete;
			vectorAPI.delete = async (
				name: string,
				...keys: string[]
			): Promise<number> => 1;

			const result = await vectorAPI.delete('test-store', 'id1');

			expect(result).toBe(1);

			vectorAPI.delete = originalDelete;
		});

		it('should return 0 when no vectors are deleted', async () => {
			const mockResponse = {
				status: 200,
				json: {
					success: true,
					data: 0,
				},
			};

			mock.module('../../src/apis/api', () => ({
				DELETE: mock(() => Promise.resolve(mockResponse)),
			}));

			const originalDelete = vectorAPI.delete;
			vectorAPI.delete = async (
				name: string,
				...keys: string[]
			): Promise<number> => 0;

			const result = await vectorAPI.delete('test-store', 'nonexistent-id');

			expect(result).toBe(0);

			vectorAPI.delete = originalDelete;
		});

		it('should throw error when delete fails', async () => {
			const mockResponse = {
				status: 400,
				json: {
					success: false,
					message: 'Delete failed',
				},
			};

			mock.module('../../src/apis/api', () => ({
				DELETE: mock(() => Promise.resolve(mockResponse)),
			}));

			const originalDelete = vectorAPI.delete;
			vectorAPI.delete = async (
				name: string,
				...keys: string[]
			): Promise<number> => {
				throw new Error('Delete failed');
			};

			await expect(vectorAPI.delete('test-store', 'id1')).rejects.toThrow(
				'Delete failed'
			);

			vectorAPI.delete = originalDelete;
		});

		it('should delete multiple vectors successfully', async () => {
			const mockResponse = {
				status: 200,
				json: {
					success: true,
					data: 3,
				},
			};

			mock.module('../../src/apis/api', () => ({
				DELETE: mock(() => Promise.resolve(mockResponse)),
			}));

			const originalDelete = vectorAPI.delete;
			vectorAPI.delete = async (
				name: string,
				...keys: string[]
			): Promise<number> => keys.length;

			const result = await vectorAPI.delete('test-store', 'id1', 'id2', 'id3');

			expect(result).toBe(3);

			vectorAPI.delete = originalDelete;
		});

		it('should handle empty keys array', async () => {
			const originalDelete = vectorAPI.delete;
			vectorAPI.delete = async (
				name: string,
				...keys: string[]
			): Promise<number> => 0;

			const result = await vectorAPI.delete('test-store');
			expect(result).toBe(0);

			vectorAPI.delete = originalDelete;
		});

		it('should handle single key with variadic syntax', async () => {
			const mockResponse = {
				status: 200,
				json: {
					success: true,
					data: 1,
				},
			};

			mock.module('../../src/apis/api', () => ({
				DELETE: mock(() => Promise.resolve(mockResponse)),
			}));

			const originalDelete = vectorAPI.delete;
			vectorAPI.delete = async (
				name: string,
				...keys: string[]
			): Promise<number> => 1;

			const result = await vectorAPI.delete('test-store', 'single-id');

			expect(result).toBe(1);

			vectorAPI.delete = originalDelete;
		});

		it('should throw error when bulk delete fails', async () => {
			const mockResponse = {
				status: 400,
				json: {
					success: false,
					message: 'Bulk delete failed',
				},
			};

			mock.module('../../src/apis/api', () => ({
				DELETE: mock(() => Promise.resolve(mockResponse)),
			}));

			const originalDelete = vectorAPI.delete;
			vectorAPI.delete = async (
				name: string,
				...keys: string[]
			): Promise<number> => {
				throw new Error('Bulk delete failed');
			};

			await expect(
				vectorAPI.delete('test-store', 'id1', 'id2')
			).rejects.toThrow('Bulk delete failed');

			vectorAPI.delete = originalDelete;
		});
	});
});
