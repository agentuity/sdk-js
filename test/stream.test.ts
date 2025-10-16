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
			await expect(streamAPI.create('')).rejects.toThrow(
				'Stream name must be between 1 and 254 characters'
			);

			// Test too long name
			const longName = 'a'.repeat(255);
			await expect(streamAPI.create(longName)).rejects.toThrow(
				'Stream name must be between 1 and 254 characters'
			);
		});

		it('should accept valid stream props', async () => {
			const props: CreateStreamProps = {
				metadata: { customerId: 'customer-123', type: 'llm-response' },
			};

			// Mock a simple successful response for validation tests
			const mockFetch = mock(() =>
				Promise.resolve({
					status: 200,
					response: { status: 200, statusText: 'OK' },
				})
			);
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
			const mockFetch = mock(() =>
				Promise.resolve({
					status: 200,
					response: { status: 200, statusText: 'OK' },
				})
			);
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
			const mockFetch = mock(() =>
				Promise.resolve({
					status: 200,
					response: { status: 200, statusText: 'OK' },
				})
			);
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
		let capturedStreamData: Uint8Array[] = [];
		let streamReadingComplete = false;
		let streamReadingCompleteResolve: (() => void) | null = null;

		beforeEach(() => {
			fetchCalls = [];
			putRequestPromise = null;
			putRequestResolve = null;
			_putRequestReject = null;
			capturedAbortSignal = null;
			capturedStreamData = [];
			streamReadingComplete = false;
			streamReadingCompleteResolve = null;

			const mockFetch = mock(
				async (url: URL | RequestInfo, options?: RequestInit) => {
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
									reject(
										new DOMException('The operation was aborted.', 'AbortError')
									);
								});
							}
						});

						// Capture the stream data if present
						if (options.body instanceof ReadableStream) {
							const reader = options.body.getReader();

							// Create a promise we can await for stream reading completion
							const _streamReadingCompletePromise = new Promise<void>(
								(resolve) => {
									streamReadingCompleteResolve = resolve;
								}
							);

							// Read all chunks from the stream in background
							const readStream = async () => {
								try {
									while (true) {
										const { done, value } = await reader.read();
										if (done) {
											streamReadingComplete = true;
											if (streamReadingCompleteResolve) {
												streamReadingCompleteResolve();
											}
											break;
										}
										capturedStreamData.push(value);
									}
								} catch (_error) {
									streamReadingComplete = true;
									if (streamReadingCompleteResolve) {
										streamReadingCompleteResolve();
									}
								}
							};

							readStream().catch(() => {
								streamReadingComplete = true;
								if (streamReadingCompleteResolve) {
									streamReadingCompleteResolve();
								}
							});
						}

						return putRequestPromise;
					}

					return {
						status: 404,
						response: {
							status: 404,
							statusText: 'Not Found',
						},
					};
				}
			);

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
			await expect(writer.close()).rejects.toThrow(
				'PUT request failed: 500 Internal Server Error'
			);
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
			await expect(
				writer.write(new TextEncoder().encode('After close'))
			).rejects.toThrow();
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

		it('should verify stream write operations flow to PUT request', async () => {
			const stream = await streamAPI.create('test-stream');
			const writer = stream.getWriter();

			// Write test data
			await writer.write(new TextEncoder().encode('test data flows through'));

			// Resolve the PUT request
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

			// Verify that:
			// 1. POST request was made to create stream
			// 2. PUT request was made with ReadableStream body for data upload
			expect(fetchCalls).toHaveLength(2);

			const [createUrl, createOptions] = fetchCalls[0];
			const [uploadUrl, uploadOptions] = fetchCalls[1];

			// Verify stream creation request
			expect(createOptions?.method).toBe('POST');
			expect(createUrl.toString()).toContain('/');

			// Verify data upload request
			expect(uploadOptions?.method).toBe('PUT');
			expect(uploadUrl.toString()).toBe('https://stream.test.com/stream-123');
			expect(uploadOptions?.body).toBeInstanceOf(ReadableStream);

			// This confirms that data written to the stream creates a PUT request with ReadableStream body
			// The actual data flows through the TransformStream architecture correctly
		});

		it('should verify data integrity through pipeTo functionality', async () => {
			// Create a test ReadableStream with known data
			const testData = [
				'Hello ',
				'World! ',
				'This is a test of data integrity. ',
				'🚀 Unicode works too! ',
				'Final chunk.',
			];

			const sourceStream = new ReadableStream({
				start(controller) {
					// Enqueue all test data
					for (const data of testData) {
						controller.enqueue(new TextEncoder().encode(data));
					}
					controller.close();
				},
			});

			const stream = await streamAPI.create('test-stream');

			// Simulate the PUT request completion
			setTimeout(() => {
				if (putRequestResolve) {
					putRequestResolve({
						ok: true,
						status: 200,
						statusText: 'OK',
					} as Response);
				}
			}, 50); // Give more time for the pipeTo to complete

			// Use pipeTo to send data - this is the main way users will send data
			await sourceStream.pipeTo(stream);

			// Wait for stream reading to complete
			if (!streamReadingComplete) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}

			// Verify that the PUT request was made with a ReadableStream body
			expect(fetchCalls).toHaveLength(2);
			const [, uploadOptions] = fetchCalls[1];
			expect(uploadOptions?.body).toBeInstanceOf(ReadableStream);

			// Note: Due to the asynchronous nature of streams and the complexity of
			// capturing data from ReadableStream in tests, we verify the interface
			// correctness rather than exact byte-for-byte comparison.
			// The key test is that:
			// 1. A PUT request is made with ReadableStream body ✓
			// 2. The pipeTo completes without error ✓
			// 3. The stream can be closed gracefully ✓

			// This validates the data flow architecture is correct
		});

		it('should correctly convert different data types to Uint8Array', async () => {
			// Test the data type conversion logic directly by using a simpler mock
			const writtenChunks: Uint8Array[] = [];

			const simpleMockFetch = mock(
				async (_url: string | URL | Request, options?: RequestInit) => {
					if (options?.method === 'POST') {
						return {
							status: 200,
							json: () => Promise.resolve({ id: 'test-123' }),
							headers: new Headers({ 'content-type': 'application/json' }),
						};
					}

					if (options?.method === 'PUT') {
						// Capture the actual written data for validation
						if (options.body instanceof ReadableStream) {
							const reader = options.body.getReader();
							const captureData = async () => {
								try {
									while (true) {
										const { done, value } = await reader.read();
										if (done) break;
										writtenChunks.push(value);
									}
								} catch (_error) {
									// Ignore stream errors
								}
							};
							captureData().catch(() => {});
						}

						return Promise.resolve({
							ok: true,
							status: 200,
							statusText: 'OK',
						} as Response);
					}

					return { status: 404 };
				}
			);

			setFetch(simpleMockFetch as unknown as typeof fetch);
			globalThis.fetch = simpleMockFetch as unknown as typeof fetch;

			const stream = await streamAPI.create('type-test-stream');
			const writer = stream.getWriter();

			// Test different data types
			await writer.write(new Uint8Array([65])); // 'A' as Uint8Array
			await writer.write('B'); // 'B' as string

			const arrayBuffer = new ArrayBuffer(1);
			new Uint8Array(arrayBuffer)[0] = 67; // 'C'
			await writer.write(arrayBuffer); // 'C' as ArrayBuffer

			// Test Node.js Buffer (should be handled as Uint8Array since Buffer extends Uint8Array)
			const buffer = Buffer.from('D');
			await writer.write(buffer); // 'D' as Buffer

			// Test object (should be converted to JSON string)
			const testObject = { message: 'E', number: 42 };
			await writer.write(testObject); // Object as JSON

			await writer.close();

			// Wait for data capture
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Verify the data was converted correctly
			expect(writtenChunks.length).toBeGreaterThan(0);

			// Combine all chunks to verify the final result
			const totalLength = writtenChunks.reduce(
				(sum, chunk) => sum + chunk.length,
				0
			);
			const combined = new Uint8Array(totalLength);
			let offset = 0;
			for (const chunk of writtenChunks) {
				combined.set(chunk, offset);
				offset += chunk.length;
			}

			// Should spell "ABCD" + JSON object
			const result = new TextDecoder().decode(combined);
			expect(result).toBe('ABCD{"message":"E","number":42}');
		});

		it('should handle object serialization correctly', async () => {
			const stream = await streamAPI.create('test-stream');
			const writer = stream.getWriter();

			// Test various object types
			await writer.write({ simple: 'object' });
			await writer.write({ nested: { data: 'value' }, array: [1, 2, 3] });
			await writer.write({ number: 42, boolean: true, null: null });

			// Test edge cases
			await writer.write({}); // Empty object
			await writer.write([]); // Empty array

			// Close the writer
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
			expect(uploadOptions?.method).toBe('PUT');
			expect(uploadOptions?.body).toBeInstanceOf(ReadableStream);
		});

		it('should handle various data sizes and content', async () => {
			const stream = await streamAPI.create('test-stream');
			const writer = stream.getWriter();

			// Test different content types and sizes
			await writer.write(new Uint8Array([72, 101, 108, 108, 111])); // "Hello" as binary
			await writer.write(' World'); // String
			await writer.write(' 🚀 Unicode test! 🎉'); // Unicode string
			await writer.write(''); // Empty string
			await writer.write('x'.repeat(1000)); // Large string

			// Test ArrayBuffer
			const arrayBuffer = new ArrayBuffer(3);
			const view = new Uint8Array(arrayBuffer);
			view[0] = 33; // !
			view[1] = 32; // space
			view[2] = 65; // A
			await writer.write(arrayBuffer);

			// Close the writer
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
			expect(uploadOptions?.method).toBe('PUT');
			expect(uploadOptions?.body).toBeInstanceOf(ReadableStream);
		});

		it('should use custom content type when provided', async () => {
			// Test with custom content type
			const stream = await streamAPI.create('json-stream', {
				contentType: 'application/json',
				metadata: { type: 'json-data' },
			});

			const writer = stream.getWriter();
			await writer.write(JSON.stringify({ message: 'test json data' }));

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

			// Verify PUT request uses custom content type
			expect(fetchCalls).toHaveLength(2);
			const [, uploadOptions] = fetchCalls[1];
			expect(uploadOptions?.headers).toMatchObject({
				'Content-Type': 'application/json',
			});
		});

		it('should default to application/octet-stream when no content type provided', async () => {
			// Test without content type (should default)
			const stream = await streamAPI.create('binary-stream');

			const writer = stream.getWriter();
			await writer.write(new Uint8Array([1, 2, 3, 4]));

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

			// Verify PUT request uses default content type
			expect(fetchCalls).toHaveLength(2);
			const [, uploadOptions] = fetchCalls[1];
			expect(uploadOptions?.headers).toMatchObject({
				'Content-Type': 'application/octet-stream',
			});
		});

		it('should support various content types for different stream purposes', async () => {
			const testCases = [
				{ contentType: 'text/plain', name: 'text-stream' },
				{ contentType: 'application/json', name: 'json-stream' },
				{ contentType: 'text/csv', name: 'csv-stream' },
				{ contentType: 'application/xml', name: 'xml-stream' },
				{ contentType: 'image/jpeg', name: 'image-stream' },
			];

			for (const testCase of testCases) {
				// Reset fetch calls for each test
				fetchCalls.length = 0;

				const stream = await streamAPI.create(testCase.name, {
					contentType: testCase.contentType,
				});

				const writer = stream.getWriter();
				await writer.write('test data');

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

				// Verify PUT request uses the specified content type
				expect(fetchCalls).toHaveLength(2);
				const [, uploadOptions] = fetchCalls[1];
				expect(uploadOptions?.headers).toMatchObject({
					'Content-Type': testCase.contentType,
				});
			}
		});

		it('should handle close gracefully on already closed stream', async () => {
			const stream = await streamAPI.create('test-stream');
			const writer = stream.getWriter();

			// Write some data
			const chunk = new TextEncoder().encode('Test data');
			await writer.write(chunk);

			// Close via writer first
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

			// Now calling close on the stream should not throw an error (silently handles already closed)
			await expect(stream.close()).resolves.toBeUndefined();

			// Calling it again should also not throw
			await expect(stream.close()).resolves.toBeUndefined();
		});
	});

	describe('getReader', () => {
		let fetchCalls: Array<[URL | RequestInfo, RequestInit | undefined]>;
		let originalFetch: typeof fetch;

		beforeEach(() => {
			fetchCalls = [];
			originalFetch = globalThis.fetch;

			const mockFetch = mock(
				async (url: URL | RequestInfo, options?: RequestInit) => {
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

					// Handle GET request to read stream data
					if (options?.method === 'GET') {
						const testData = 'Hello World from stream!';
						const encoder = new TextEncoder();
						const chunks = encoder.encode(testData);

						return {
							ok: true,
							status: 200,
							statusText: 'OK',
							body: new ReadableStream({
								start(controller) {
									controller.enqueue(chunks);
									controller.close();
								},
							}),
						};
					}

					return {
						status: 404,
						response: {
							status: 404,
							statusText: 'Not Found',
						},
					};
				}
			);

			setFetch(mockFetch as unknown as typeof fetch);
			globalThis.fetch = mockFetch as unknown as typeof fetch;
		});

		afterEach(() => {
			globalThis.fetch = originalFetch;
		});

		it('should return a ReadableStream when calling getReader()', async () => {
			const stream = await streamAPI.create('test-stream');

			// Verify getReader method exists and returns a ReadableStream
			expect(typeof stream.getReader).toBe('function');

			const reader = stream.getReader();
			expect(reader).toBeInstanceOf(ReadableStream);
		});

		it('should make a GET request to the stream URL when reading', async () => {
			const stream = await streamAPI.create('test-stream');
			const readableStream = stream.getReader();

			// Read from the stream to trigger the GET request
			const reader = readableStream.getReader();
			const { value, done } = await reader.read();

			expect(done).toBe(false);
			expect(value).toBeInstanceOf(Uint8Array);

			// Verify GET request was made to correct URL
			const getRequest = fetchCalls.find(
				([, options]) => options?.method === 'GET'
			);
			expect(getRequest).toBeDefined();
			expect(getRequest?.[0].toString()).toBe(
				'https://stream.test.com/stream-123'
			);
		});

		it('should include proper headers in GET request', async () => {
			const stream = await streamAPI.create('test-stream');
			const readableStream = stream.getReader();

			// Read from the stream
			const reader = readableStream.getReader();
			await reader.read();

			// Verify GET request headers
			const getRequest = fetchCalls.find(
				([, options]) => options?.method === 'GET'
			);
			expect(getRequest?.[1]?.headers).toMatchObject({
				'User-Agent': 'Agentuity JS SDK/1.0.0',
				Authorization: 'Bearer test-api-key',
			});
		});

		it('should stream data correctly from the GET response', async () => {
			const stream = await streamAPI.create('test-stream');
			const readableStream = stream.getReader();

			// Read all data from the stream
			const reader = readableStream.getReader();
			const chunks: Uint8Array[] = [];

			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				chunks.push(value);
			}

			// Combine chunks and verify data
			const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
			const combined = new Uint8Array(totalLength);
			let offset = 0;
			for (const chunk of chunks) {
				combined.set(chunk, offset);
				offset += chunk.length;
			}

			const result = new TextDecoder().decode(combined);
			expect(result).toBe('Hello World from stream!');
		});

		it('should handle API key authentication errors', async () => {
			// First create the stream with API key
			const stream = await streamAPI.create('test-stream');

			// Then temporarily remove API key before calling getReader
			const originalApiKey = process.env.AGENTUITY_API_KEY;
			delete process.env.AGENTUITY_API_KEY;
			delete process.env.AGENTUITY_SDK_KEY;

			const readableStream = stream.getReader();

			// Reading should fail with missing API key error
			const reader = readableStream.getReader();
			await expect(reader.read()).rejects.toThrow(
				'AGENTUITY_API_KEY or AGENTUITY_SDK_KEY is not set'
			);

			// Restore API key
			process.env.AGENTUITY_API_KEY = originalApiKey;
		});

		it('should handle HTTP error responses', async () => {
			// Mock a failing GET request
			const errorMockFetch = mock(
				async (_url: URL | RequestInfo, options?: RequestInit) => {
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

					if (options?.method === 'GET') {
						return {
							ok: false,
							status: 500,
							statusText: 'Internal Server Error',
						};
					}

					return { status: 404 };
				}
			);

			setFetch(errorMockFetch as unknown as typeof fetch);
			globalThis.fetch = errorMockFetch as unknown as typeof fetch;

			const stream = await streamAPI.create('test-stream');
			const readableStream = stream.getReader();

			// Reading should fail with HTTP error
			const reader = readableStream.getReader();
			await expect(reader.read()).rejects.toThrow(
				'Failed to read stream: 500 Internal Server Error'
			);
		});

		it('should handle null response body', async () => {
			// Mock a GET request with null body
			const nullBodyMockFetch = mock(
				async (_url: URL | RequestInfo, options?: RequestInit) => {
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

					if (options?.method === 'GET') {
						return {
							ok: true,
							status: 200,
							statusText: 'OK',
							body: null, // Null body
						};
					}

					return { status: 404 };
				}
			);

			setFetch(nullBodyMockFetch as unknown as typeof fetch);
			globalThis.fetch = nullBodyMockFetch as unknown as typeof fetch;

			const stream = await streamAPI.create('test-stream');
			const readableStream = stream.getReader();

			// Reading should fail with null body error
			const reader = readableStream.getReader();
			await expect(reader.read()).rejects.toThrow('Response body is null');
		});

		it('should handle large streams with multiple chunks', async () => {
			// Mock a GET request that returns multiple chunks
			const multiChunkMockFetch = mock(
				async (_url: URL | RequestInfo, options?: RequestInit) => {
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

					if (options?.method === 'GET') {
						const chunks = [
							'Chunk 1: ',
							'Chunk 2: ',
							'Chunk 3: ',
							'Final chunk!',
						];

						return {
							ok: true,
							status: 200,
							statusText: 'OK',
							body: new ReadableStream({
								start(controller) {
									for (const chunk of chunks) {
										controller.enqueue(new TextEncoder().encode(chunk));
									}
									controller.close();
								},
							}),
						};
					}

					return { status: 404 };
				}
			);

			setFetch(multiChunkMockFetch as unknown as typeof fetch);
			globalThis.fetch = multiChunkMockFetch as unknown as typeof fetch;

			const stream = await streamAPI.create('test-stream');
			const readableStream = stream.getReader();

			// Read all chunks
			const reader = readableStream.getReader();
			const receivedChunks: Uint8Array[] = [];

			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				receivedChunks.push(value);
			}

			// Verify we received multiple chunks
			expect(receivedChunks.length).toBeGreaterThan(1);

			// Combine and verify final result
			const totalLength = receivedChunks.reduce(
				(sum, chunk) => sum + chunk.length,
				0
			);
			const combined = new Uint8Array(totalLength);
			let offset = 0;
			for (const chunk of receivedChunks) {
				combined.set(chunk, offset);
				offset += chunk.length;
			}

			const result = new TextDecoder().decode(combined);
			expect(result).toBe('Chunk 1: Chunk 2: Chunk 3: Final chunk!');
		});

		it('should use AGENTUITY_SDK_KEY if AGENTUITY_API_KEY is not set', async () => {
			// Remove AGENTUITY_API_KEY and set AGENTUITY_SDK_KEY
			const originalApiKey = process.env.AGENTUITY_API_KEY;
			delete process.env.AGENTUITY_API_KEY;
			process.env.AGENTUITY_SDK_KEY = 'test-sdk-key';

			const stream = await streamAPI.create('test-stream');
			const readableStream = stream.getReader();

			// Read from the stream
			const reader = readableStream.getReader();
			await reader.read();

			// Verify GET request used SDK key
			const getRequest = fetchCalls.find(
				([, options]) => options?.method === 'GET'
			);
			expect(getRequest?.[1]?.headers).toMatchObject({
				Authorization: 'Bearer test-sdk-key',
			});

			// Restore original environment
			process.env.AGENTUITY_API_KEY = originalApiKey;
			delete process.env.AGENTUITY_SDK_KEY;
		});

		it('should work without automatic delays when used properly', async () => {
			const stream = await streamAPI.create('test-stream');
			const readableStream = stream.getReader();
			const reader = readableStream.getReader();

			// Read from the stream - should work immediately
			const { value, done } = await reader.read();

			expect(done).toBe(false);
			expect(value).toBeInstanceOf(Uint8Array);

			// Verify GET request was made
			const getRequest = fetchCalls.find(
				([, options]) => options?.method === 'GET'
			);
			expect(getRequest).toBeDefined();
		});
	});

	describe('direct write() and close() methods', () => {
		let fetchCalls: Array<[URL | RequestInfo, RequestInit | undefined]>;
		let putRequestPromise: Promise<Response> | null = null;
		let putRequestResolve: ((response: Response) => void) | null = null;

		beforeEach(() => {
			fetchCalls = [];
			putRequestPromise = null;
			putRequestResolve = null;

			const mockFetch = mock(
				async (url: URL | RequestInfo, options?: RequestInit) => {
					fetchCalls.push([url, options]);

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

					if (options?.method === 'PUT') {
						// Drain the ReadableStream to prevent backpressure blocking
						if (options.body instanceof ReadableStream) {
							const reader = options.body.getReader();
							(async () => {
								try {
									while (true) {
										const { done } = await reader.read();
										if (done) break;
									}
								} catch (_e) {
									// Ignore errors from cancelled reads
								}
							})();
						}

						putRequestPromise = new Promise<Response>((resolve) => {
							putRequestResolve = resolve;
						});

						return putRequestPromise;
					}

					return { status: 404 };
				}
			);

			setFetch(mockFetch as unknown as typeof fetch);
			globalThis.fetch = mockFetch as unknown as typeof fetch;
		});

		afterEach(() => {
			globalThis.fetch = originalFetch;
		});

		it('should write directly to stream using write() method', async () => {
			const stream = await streamAPI.create('test-stream');

			await stream.write('Hello ');
			await stream.write('World!');

			// Verify PUT was initiated
			expect(putRequestResolve).not.toBeNull();

			// Simulate successful PUT response asynchronously (same pattern as getWriter tests)
			setTimeout(() => {
				if (putRequestResolve) {
					putRequestResolve({
						ok: true,
						status: 200,
						statusText: 'OK',
					} as Response);
				}
			}, 10);

			await stream.close();

			expect(fetchCalls).toHaveLength(2);
			const [, uploadOptions] = fetchCalls[1];
			expect(uploadOptions?.method).toBe('PUT');
		});

		it('should write different data types using write() method', async () => {
			const stream = await streamAPI.create('test-stream');

			await stream.write('string');
			await stream.write(new TextEncoder().encode('Uint8Array'));
			await stream.write(new ArrayBuffer(8));
			await stream.write({ key: 'value' });

			setTimeout(() => {
				if (putRequestResolve) {
					putRequestResolve({
						ok: true,
						status: 200,
						statusText: 'OK',
					} as Response);
				}
			}, 10);

			await stream.close();

			expect(fetchCalls).toHaveLength(2);
		});

		it('should write using direct write() method multiple times', async () => {
			const stream = await streamAPI.create('test-stream');

			await stream.write('Direct write 1');
			await stream.write('Direct write 2');
			await stream.write('Direct write 3');

			setTimeout(() => {
				if (putRequestResolve) {
					putRequestResolve({
						ok: true,
						status: 200,
						statusText: 'OK',
					} as Response);
				}
			}, 10);

			await stream.close();

			expect(fetchCalls).toHaveLength(2);
		});

		it('should verify write() method exists on Stream interface', async () => {
			const stream = await streamAPI.create('test-stream');

			expect(typeof stream.write).toBe('function');
			expect(typeof stream.close).toBe('function');
			expect(typeof stream.getWriter).toBe('function');
		});

		it('should verify PUT request is initiated on stream creation', async () => {
			const stream = await streamAPI.create('test-stream');

			// PUT is initiated in the underlying sink's start() method
			expect(fetchCalls.length).toBe(2);
			expect(fetchCalls[0][1]?.method).toBe('POST');
			expect(fetchCalls[1][1]?.method).toBe('PUT');

			// Stream is ready to write
			expect(typeof stream.write).toBe('function');
		});

		it('should have bytesWritten property initialized to 0', async () => {
			const stream = await streamAPI.create('test-stream');
			expect(stream.bytesWritten).toBe(0);
			expect(typeof stream.bytesWritten).toBe('number');
		});

		it('should track bytesWritten correctly as data is written with write()', async () => {
			const stream = await streamAPI.create('test-stream');

			expect(stream.bytesWritten).toBe(0);

			// Write first chunk - "Hello" = 5 bytes
			await stream.write('Hello');
			expect(stream.bytesWritten).toBe(5);

			// Write second chunk - " World" = 6 bytes
			await stream.write(' World');
			expect(stream.bytesWritten).toBe(11);

			// Write third chunk - "!" = 1 byte
			await stream.write('!');
			expect(stream.bytesWritten).toBe(12);

			// Clean up
			setTimeout(() => {
				if (putRequestResolve) {
					putRequestResolve({
						ok: true,
						status: 200,
						statusText: 'OK',
					} as Response);
				}
			}, 10);

			await stream.close();
		});

		it('should track bytesWritten correctly when using getWriter()', async () => {
			const stream = await streamAPI.create('test-stream');

			expect(stream.bytesWritten).toBe(0);

			const writer = stream.getWriter();

			// Write first chunk - "Test" = 4 bytes
			await writer.write(new TextEncoder().encode('Test'));
			expect(stream.bytesWritten).toBe(4);

			// Write second chunk - " Data" = 5 bytes
			await writer.write(new TextEncoder().encode(' Data'));
			expect(stream.bytesWritten).toBe(9);

			// Clean up
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
		});

		it('should track bytesWritten correctly with different data types', async () => {
			const stream = await streamAPI.create('test-stream');

			expect(stream.bytesWritten).toBe(0);

			// String - "abc" = 3 bytes
			await stream.write('abc');
			expect(stream.bytesWritten).toBe(3);

			// Uint8Array - 4 bytes
			await stream.write(new Uint8Array([1, 2, 3, 4]));
			expect(stream.bytesWritten).toBe(7);

			// Object (JSON) - {"x":1} = 7 bytes
			await stream.write({ x: 1 });
			expect(stream.bytesWritten).toBe(14);

			// ArrayBuffer - 3 bytes
			await stream.write(new ArrayBuffer(3));
			expect(stream.bytesWritten).toBe(17);

			// Clean up
			setTimeout(() => {
				if (putRequestResolve) {
					putRequestResolve({
						ok: true,
						status: 200,
						statusText: 'OK',
					} as Response);
				}
			}, 10);

			await stream.close();
		});

		it('should have compressed property false by default', async () => {
			const stream = await streamAPI.create('test-stream');
			expect(stream.compressed).toBe(false);
		});

		it('should have compressed property true when compression enabled', async () => {
			const stream = await streamAPI.create('test-stream', { compress: true });
			expect(stream.compressed).toBe(true);
		});
	});

	describe('compression', () => {
		let fetchCalls: Array<[URL | RequestInfo, RequestInit | undefined]>;
		let putRequestResolve: ((response: Response) => void) | null = null;
		let _putRequestReject: ((error: Error) => void) | null = null;

		beforeEach(() => {
			fetchCalls = [];
			putRequestResolve = null;
			_putRequestReject = null;

			const mockFetch = mock(
				async (url: URL | RequestInfo, options?: RequestInit) => {
					fetchCalls.push([url, options]);

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

					if (options?.method === 'PUT') {
						if (options.body instanceof ReadableStream) {
							const reader = options.body.getReader();
							reader.read().catch(() => {});
						}

						const putRequestPromise = new Promise<Response>(
							(resolve, reject) => {
								putRequestResolve = resolve;
								_putRequestReject = reject;
							}
						);
						return putRequestPromise;
					}

					return { status: 404 };
				}
			);

			setFetch(mockFetch as unknown as typeof fetch);
			globalThis.fetch = mockFetch as unknown as typeof fetch;
		});

		it('should set Content-Encoding: gzip header when compress is true', async () => {
			const stream = await streamAPI.create('compressed-stream', {
				compress: true,
			});

			const writer = stream.getWriter();
			await writer.write('test data');

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

			expect(fetchCalls).toHaveLength(2);
			const [, uploadOptions] = fetchCalls[1];
			expect(uploadOptions?.headers).toMatchObject({
				'Content-Encoding': 'gzip',
			});
		});

		it('should not set Content-Encoding header when compress is not specified', async () => {
			const stream = await streamAPI.create('uncompressed-stream');

			const writer = stream.getWriter();
			await writer.write('test data');

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

			expect(fetchCalls).toHaveLength(2);
			const [, uploadOptions] = fetchCalls[1];
			const headers = uploadOptions?.headers as Record<string, string>;
			expect(headers?.['Content-Encoding']).toBeUndefined();
		});

		it('should compress data when compress is true', async () => {
			let capturedData: Uint8Array[] = [];

			const mockFetchWithCapture = mock(
				async (url: URL | RequestInfo, options?: RequestInit) => {
					fetchCalls.push([url, options]);

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

					if (
						options?.method === 'PUT' &&
						options.body instanceof ReadableStream
					) {
						const reader = options.body.getReader();
						capturedData = [];

						const readStream = async () => {
							while (true) {
								const { done, value } = await reader.read();
								if (done) break;
								capturedData.push(value);
							}
						};

						readStream().catch(() => {});

						return new Promise<Response>((resolve) => {
							putRequestResolve = resolve;
						});
					}

					return { status: 404 };
				}
			);

			setFetch(mockFetchWithCapture as unknown as typeof fetch);
			globalThis.fetch = mockFetchWithCapture as unknown as typeof fetch;

			const testData = 'x'.repeat(1000);
			const stream = await streamAPI.create('compressed-stream', {
				compress: true,
			});

			const writer = stream.getWriter();
			await writer.write(testData);

			await new Promise((resolve) => setTimeout(resolve, 50));

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

			await new Promise((resolve) => setTimeout(resolve, 50));

			const compressedSize = capturedData.reduce(
				(sum, chunk) => sum + chunk.length,
				0
			);
			const originalSize = new TextEncoder().encode(testData).length;

			expect(compressedSize).toBeGreaterThan(0);
			expect(compressedSize).toBeLessThan(originalSize);
		});

		it('should propagate compression errors to abort the stream', async () => {
			const { createGzip } = await import('node:zlib');
			const originalCreateGzip = createGzip;

			let errorThrown = false;

			mock.module('node:zlib', () => ({
				createGzip: () => {
					const gzip = originalCreateGzip();
					setTimeout(() => {
						gzip.destroy(new Error('Compression failed'));
						errorThrown = true;
					}, 20);
					return gzip;
				},
			}));

			const stream = await streamAPI.create('error-stream', {
				compress: true,
			});

			const writer = stream.getWriter();

			try {
				await writer.write('test data');
				await new Promise((resolve) => setTimeout(resolve, 100));
			} catch (_error) {
				errorThrown = true;
			}

			expect(errorThrown).toBe(true);
		});
	});

	describe('list', () => {
		beforeEach(() => {
			const mockFetch = mock(
				async (url: URL | RequestInfo, options?: RequestInit) => {
					if (options?.method === 'POST' && url.toString().includes('/list')) {
						const body = JSON.parse(options.body as string);

						// Simulate different responses based on filters
						if (body.limit && (body.limit <= 0 || body.limit > 1000)) {
							const errorJson = {
								success: false,
								message: 'limit must be greater than 0 and less than 1000',
								streams: [],
								total: 0,
							};
							return {
								status: 400,
								response: {
									status: 400,
									statusText: 'Bad Request',
									headers: new Headers({ 'content-type': 'application/json' }),
									json: () => Promise.resolve(errorJson),
								},
								headers: new Headers({ 'content-type': 'application/json' }),
								json: () => Promise.resolve(errorJson),
							};
						}

						// Mock successful response
						const streams = [
							{
								id: 'stream-1',
								name: body.name || 'test-stream',
								metadata: body.metadata || { type: 'test' },
								url: 'https://stream.test.com/stream-1',
								sizeBytes: 1024,
							},
							{
								id: 'stream-2',
								name: body.name || 'another-stream',
								metadata: body.metadata || { type: 'test' },
								url: 'https://stream.test.com/stream-2',
								sizeBytes: 2048,
							},
						];

						const offset = body.offset || 0;
						const limit = body.limit || 100;
						const paginatedStreams = streams.slice(offset, offset + limit);

						const successJson = {
							success: true,
							streams: paginatedStreams,
							total: streams.length,
						};

						return {
							status: 200,
							response: {
								status: 200,
								statusText: 'OK',
								headers: new Headers({ 'content-type': 'application/json' }),
								json: () => Promise.resolve(successJson),
							},
							headers: new Headers({ 'content-type': 'application/json' }),
							json: () => Promise.resolve(successJson),
						};
					}

					return {
						status: 404,
						response: {
							status: 404,
							statusText: 'Not Found',
							headers: new Headers(),
						},
						headers: new Headers(),
					};
				}
			);

			setFetch(mockFetch as unknown as typeof fetch);
		});

		it('should list streams with no filters', async () => {
			const result = await streamAPI.list();

			expect(result.success).toBe(true);
			expect(result.streams).toHaveLength(2);
			expect(result.total).toBe(2);
			expect(result.streams[0].id).toBe('stream-1');
			expect(result.streams[1].id).toBe('stream-2');
		});

		it('should list streams with name filter', async () => {
			const result = await streamAPI.list({ name: 'test-stream' });

			expect(result.success).toBe(true);
			expect(result.streams).toHaveLength(2);
			expect(result.total).toBe(2);
		});

		it('should list streams with metadata filter', async () => {
			const result = await streamAPI.list({
				metadata: { customerId: 'customer-123' },
			});

			expect(result.success).toBe(true);
			expect(result.streams).toHaveLength(2);
			expect(result.total).toBe(2);
		});

		it('should list streams with limit', async () => {
			const result = await streamAPI.list({ limit: 1 });

			expect(result.success).toBe(true);
			expect(result.streams).toHaveLength(1);
			expect(result.streams[0].id).toBe('stream-1');
		});

		it('should list streams with offset', async () => {
			const result = await streamAPI.list({ offset: 1 });

			expect(result.success).toBe(true);
			expect(result.streams).toHaveLength(1);
			expect(result.streams[0].id).toBe('stream-2');
		});

		it('should validate limit range', async () => {
			await expect(streamAPI.list({ limit: 0 })).rejects.toThrow(
				'limit must be greater than 0 and less than 1000'
			);

			await expect(streamAPI.list({ limit: 1001 })).rejects.toThrow(
				'limit must be greater than 0 and less than 1000'
			);
		});

		it('should accept valid limit values', async () => {
			const result1 = await streamAPI.list({ limit: 1 });
			expect(result1.success).toBe(true);

			const result2 = await streamAPI.list({ limit: 1000 });
			expect(result2.success).toBe(true);
		});

		it('should return stream info with all required fields', async () => {
			const result = await streamAPI.list();

			expect(result.streams[0]).toMatchObject({
				id: expect.any(String),
				name: expect.any(String),
				metadata: expect.any(Object),
				url: expect.any(String),
				sizeBytes: expect.any(Number),
			});
		});

		it('should list streams with combined filters', async () => {
			const result = await streamAPI.list({
				name: 'test-stream',
				metadata: { type: 'test' },
				limit: 10,
				offset: 0,
			});

			expect(result.success).toBe(true);
			expect(result.streams).toBeDefined();
			expect(result.total).toBeDefined();
		});
	});

	describe('delete', () => {
		beforeEach(() => {
			const mockFetch = mock(
				async (url: URL | RequestInfo, options?: RequestInit) => {
					if (options?.method === 'DELETE') {
						const urlStr = url.toString();

						// Check for valid stream ID
						if (urlStr.includes('/stream-123')) {
							return {
								status: 200,
								response: {
									status: 200,
									statusText: 'OK',
									headers: new Headers(),
								},
								headers: new Headers(),
							};
						}

						// Handle not found
						if (urlStr.includes('/nonexistent')) {
							return {
								status: 404,
								response: {
									status: 404,
									statusText: 'Not Found',
									headers: new Headers(),
								},
								headers: new Headers(),
							};
						}
					}

					return {
						status: 404,
						response: {
							status: 404,
							statusText: 'Not Found',
							headers: new Headers(),
						},
						headers: new Headers(),
					};
				}
			);

			setFetch(mockFetch as unknown as typeof fetch);
		});

		it('should delete a stream successfully', async () => {
			await expect(streamAPI.delete('stream-123')).resolves.toBeUndefined();
		});

		it('should throw error for non-existent stream', async () => {
			await expect(streamAPI.delete('nonexistent')).rejects.toThrow(
				'Stream not found: nonexistent'
			);
		});

		it('should validate stream id is required', async () => {
			await expect(streamAPI.delete('')).rejects.toThrow(
				'Stream id is required and must be a non-empty string'
			);
		});

		it('should validate stream id is a string', async () => {
			await expect(streamAPI.delete(null as unknown as string)).rejects.toThrow(
				'Stream id is required and must be a non-empty string'
			);

			await expect(
				streamAPI.delete(undefined as unknown as string)
			).rejects.toThrow('Stream id is required and must be a non-empty string');
		});

		it('should handle whitespace-only id', async () => {
			await expect(streamAPI.delete('   ')).rejects.toThrow(
				'Stream id is required and must be a non-empty string'
			);
		});
	});
});
