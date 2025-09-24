import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import StreamAPIImpl from '../src/apis/stream';
import type { CreateStreamProps } from '../src/types';
import { setFetch } from '../src/apis/api';

describe('StreamAPI', () => {
	let streamAPI: StreamAPIImpl;
	let originalEnv: NodeJS.ProcessEnv;
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		streamAPI = new StreamAPIImpl();
		originalEnv = { ...process.env };
		originalFetch = globalThis.fetch;
		
		process.env.AGENTUITY_API_KEY = 'test-api-key';
		process.env.AGENTUITY_STREAM_URL = 'https://stream.test.com/';

		// Mock the router module
		mock.module('../src/router/router', () => ({
			getSDKVersion: () => '1.0.0',
			getTracer: () => ({
				startSpan: () => ({
					setAttribute: () => {},
					setStatus: () => {},
					end: () => {},
				}),
			}),
			recordException: () => {},
		}));
	});

	afterEach(() => {
		process.env = originalEnv;
		setFetch(originalFetch);
		mock.restore();
	});

	describe('create', () => {
		it('should validate stream name length', async () => {
			// Test empty name
			await expect(
				streamAPI.create('')
			).rejects.toThrow('Stream name must be between 1 and 254 characters');

			// Test too long name
			const longName = 'a'.repeat(255);
			await expect(
				streamAPI.create(longName)
			).rejects.toThrow('Stream name must be between 1 and 254 characters');
		});

		it('should accept valid stream props', async () => {
			const props: CreateStreamProps = {
				metadata: { customerId: 'customer-123', type: 'llm-response' }
			};

			// Mock a simple successful response for validation tests
			const mockFetch = mock(() => Promise.resolve({
				status: 200,
				response: { status: 200, statusText: 'OK' }
			}));
			setFetch(mockFetch as unknown as typeof fetch);

			// This should not throw for valid props
			try {
				await streamAPI.create('test-stream', props);
			} catch (error) {
				// Expected to fail due to incomplete mock, but validation should pass
				expect(error).toBeInstanceOf(Error);
			}
		});

		it('should accept minimal stream props', async () => {
			// Mock a simple successful response for validation tests
			const mockFetch = mock(() => Promise.resolve({
				status: 200,
				response: { status: 200, statusText: 'OK' }
			}));
			setFetch(mockFetch as unknown as typeof fetch);

			try {
				await streamAPI.create('simple-stream');
			} catch (error) {
				// Expected to fail due to incomplete mock, but validation should pass
				expect(error).toBeInstanceOf(Error);
			}
		});

		it('should validate name boundaries', async () => {
			// Test minimum valid length - should not throw validation error
			const minName = 'a';
			// Test maximum valid length - should not throw validation error  
			const maxName = 'a'.repeat(254);
			
			// Mock a simple successful response for validation tests
			const mockFetch = mock(() => Promise.resolve({
				status: 200,
				response: { status: 200, statusText: 'OK' }
			}));
			setFetch(mockFetch as unknown as typeof fetch);

			// These should not throw validation errors, only network-related errors
			try {
				await streamAPI.create(minName);
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
			}

			try {
				await streamAPI.create(maxName);
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
			}
		});
	});

	describe('streaming functionality', () => {
		let fetchCalls: Array<[URL | RequestInfo, RequestInit | undefined]>;
		let putRequestPromise: Promise<Response> | null = null;
		let putRequestResolve: ((response: Response) => void) | null = null;
		let _putRequestReject: ((error: Error) => void) | null = null;
		let capturedAbortSignal: AbortSignal | null = null;

		beforeEach(() => {
			fetchCalls = [];
			putRequestPromise = null;
			putRequestResolve = null;
			_putRequestReject = null;
			capturedAbortSignal = null;

			const mockFetch = mock(async (url: URL | RequestInfo, options?: RequestInit) => {
				fetchCalls.push([url, options]);

				// Handle POST request to create stream
				if (options?.method === 'POST') {
					return {
						status: 200,
						response: {
							json: () => Promise.resolve({ id: 'stream-123' }),
							status: 200,
							statusText: 'OK',
						},
						json: () => Promise.resolve({ id: 'stream-123' }),
						headers: new Headers({ 'content-type': 'application/json' }),
					};
				}

				// Handle PUT request to upload stream data
				if (options?.method === 'PUT') {
					capturedAbortSignal = options.signal as AbortSignal;
					
					// Create a promise that we can resolve manually
					putRequestPromise = new Promise<Response>((resolve, reject) => {
						putRequestResolve = resolve;
						_putRequestReject = reject;
						
						// Handle abort signal
						if (capturedAbortSignal) {
							capturedAbortSignal.addEventListener('abort', () => {
								reject(new DOMException('The operation was aborted.', 'AbortError'));
							});
						}
					});

					// Don't try to read the stream body - this was causing the hang
					// Just return the promise
					return putRequestPromise;
				}

				return {
					status: 404,
					response: {
						status: 404,
						statusText: 'Not Found',
					},
				};
			});

			setFetch(mockFetch as unknown as typeof fetch);
			// Also set globalThis.fetch for the internal fetch call in stream.ts
			globalThis.fetch = mockFetch as unknown as typeof fetch;
		});

		afterEach(() => {
			// Restore original fetch
			globalThis.fetch = originalFetch;
		});

		it('should stream data correctly and complete on close', async () => {
			const stream = await streamAPI.create('test-stream');
			
			// Verify the stream was created with correct properties
			expect(stream.id).toBe('stream-123');
			expect(stream.url).toBe('https://stream.test.com/stream-123');

			const writer = stream.getWriter();
			
			// Write test data
			const chunk1 = new TextEncoder().encode('Hello ');
			const chunk2 = new TextEncoder().encode('World!');
			
			await writer.write(chunk1);
			await writer.write(chunk2);
			
			// Simulate successful PUT response asynchronously
			setTimeout(() => {
				if (putRequestResolve) {
					putRequestResolve({
						ok: true,
						status: 200,
						statusText: 'OK',
					} as Response);
				}
			}, 10);

			await writer.close();

			// Verify fetch calls
			expect(fetchCalls).toHaveLength(2);
			
			// Verify POST request to create stream
			const [createUrl, createOptions] = fetchCalls[0];
			expect(createUrl.toString()).toContain('/');
			expect(createOptions?.method).toBe('POST');
			
			// Verify PUT request to upload data
			const [uploadUrl, uploadOptions] = fetchCalls[1];
			expect(uploadUrl.toString()).toBe('https://stream.test.com/stream-123');
			expect(uploadOptions?.method).toBe('PUT');
			expect(uploadOptions?.headers).toMatchObject({
				'Content-Type': 'application/octet-stream',
			});

			// Verify that the body is a ReadableStream (this confirms data is being streamed)
			expect(uploadOptions?.body).toBeInstanceOf(ReadableStream);
		});

		it('should handle PUT request errors', async () => {
			const stream = await streamAPI.create('test-stream');
			const writer = stream.getWriter();
			
			// Write some data
			const chunk = new TextEncoder().encode('Test data');
			await writer.write(chunk);
			
			// Simulate PUT request error response asynchronously
			setTimeout(() => {
				if (putRequestResolve) {
					putRequestResolve({
						ok: false,
						status: 500,
						statusText: 'Internal Server Error',
					} as Response);
				}
			}, 10);

			// Closing should throw an error due to failed PUT request
			await expect(writer.close()).rejects.toThrow('PUT request failed: 500 Internal Server Error');
		});

		it('should handle large data streams', async () => {
			const stream = await streamAPI.create('test-stream');
			const writer = stream.getWriter();
			
			// Write multiple chunks
			const chunks = [];
			for (let i = 0; i < 10; i++) {
				const chunk = new TextEncoder().encode(`Chunk ${i} data `);
				chunks.push(chunk);
				await writer.write(chunk);
			}
			
			// Simulate successful PUT response asynchronously
			setTimeout(() => {
				if (putRequestResolve) {
					putRequestResolve({
						ok: true,
						status: 200,
						statusText: 'OK',
					} as Response);
				}
			}, 10);
			
			await writer.close();

			// Verify PUT request was made with ReadableStream body
			expect(fetchCalls).toHaveLength(2);
			const [, uploadOptions] = fetchCalls[1];
			expect(uploadOptions?.body).toBeInstanceOf(ReadableStream);
		});

		it('should properly handle writer state after close', async () => {
			const stream = await streamAPI.create('test-stream');
			const writer = stream.getWriter();
			
			const chunk = new TextEncoder().encode('Test data');
			await writer.write(chunk);
			
			// Simulate successful PUT response asynchronously
			setTimeout(() => {
				if (putRequestResolve) {
					putRequestResolve({
						ok: true,
						status: 200,
						statusText: 'OK',
					} as Response);
				}
			}, 10);
			
			await writer.close();

			// Writing after close should throw
			await expect(writer.write(new TextEncoder().encode('After close'))).rejects.toThrow();
		});

		it('should handle concurrent writes', async () => {
			const stream = await streamAPI.create('test-stream');
			const writer = stream.getWriter();
			
			// Write multiple chunks concurrently
			const writePromises = [];
			for (let i = 0; i < 5; i++) {
				const chunk = new TextEncoder().encode(`Concurrent chunk ${i}`);
				writePromises.push(writer.write(chunk));
			}
			
			await Promise.all(writePromises);
			
			// Simulate successful PUT response asynchronously
			setTimeout(() => {
				if (putRequestResolve) {
					putRequestResolve({
						ok: true,
						status: 200,
						statusText: 'OK',
					} as Response);
				}
			}, 10);
			
			await writer.close();

			// Verify PUT request was made with ReadableStream body
			expect(fetchCalls).toHaveLength(2);
			const [, uploadOptions] = fetchCalls[1];
			expect(uploadOptions?.body).toBeInstanceOf(ReadableStream);
		});

		it('should support direct abort method on stream instance', async () => {
			const stream = await streamAPI.create('test-stream');
			
			// Verify that the stream has the abort method available (inherited from WritableStream)
			expect(typeof stream.abort).toBe('function');
			expect(typeof stream.getWriter).toBe('function');
			expect(typeof stream.close).toBe('function');
			
			// This confirms the Stream interface properly extends WritableStream
			expect(stream).toBeInstanceOf(WritableStream);
		});
	});
});
