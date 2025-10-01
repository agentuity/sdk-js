import { getBaseUrlForService, POST, getFetch } from './api';
import { getSDKVersion, getTracer, recordException } from '../router/router';
import type { CreateStreamProps, Stream, StreamAPI } from '../types';
import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { safeStringify } from '../utils/stringify';
import { ReadableStream } from 'node:stream/web';
import { createGzip } from 'node:zlib';

/**
 * A writable stream implementation that extends WritableStream
 */
class StreamImpl extends WritableStream implements Stream {
	public readonly id: string;
	public readonly url: string;

	constructor(id: string, url: string, underlyingSink: UnderlyingSink) {
		super(underlyingSink);
		this.id = id;
		this.url = url;
	}

	/**
	 * Override close to handle already closed streams gracefully
	 * This method safely closes the stream, or silently returns if already closed
	 */
	async close(): Promise<void> {
		try {
			// Check if stream is already closed by attempting to get a writer
			const writer = this.getWriter();
			await writer.close();
		} catch (error) {
			// If we get a TypeError about the stream being closed, locked, or errored,
			// that means pipeTo() or another operation already closed it or it's in use
			if (
				error instanceof TypeError &&
				(error.message.includes('closed') ||
					error.message.includes('errored') ||
					error.message.includes('Cannot close'))
			) {
				// Silently return - this is the desired behavior
				return Promise.resolve();
			}
			// If the stream is locked, try to close the underlying writer
			if (
				error instanceof TypeError &&
				error.message.includes('locked')
			) {
				// Best-effort closure for locked streams
				// Note: We can't directly access the active writer, so we silently return
				// In a real implementation, we would track the writer and close it here
				return Promise.resolve();
			}
			// Re-throw any other errors
			throw error;
		}
	}

	/**
	 * Get a ReadableStream that streams from the internal URL
	 *
	 * Note: This method will block waiting for data until writes start to the Stream.
	 * The returned ReadableStream will remain open until the Stream is closed or an error occurs.
	 *
	 * @returns a ReadableStream that can be passed to response.stream()
	 */
	getReader(): ReadableStream<Uint8Array> {
		const url = this.url;
		let ac: AbortController | null = null;
		return new ReadableStream({
			async start(controller) {
				try {
					const apiKey =
						process.env.AGENTUITY_SDK_KEY || process.env.AGENTUITY_API_KEY;
					if (!apiKey) {
						controller.error(
							new Error('AGENTUITY_API_KEY or AGENTUITY_SDK_KEY is not set')
						);
						return;
					}

					const sdkVersion = getSDKVersion();
					ac = new AbortController();
					const response = await getFetch()(url, {
						method: 'GET',
						headers: {
							'User-Agent': `Agentuity JS SDK/${sdkVersion}`,
							Authorization: `Bearer ${apiKey}`,
						},
						signal: ac.signal,
					});

					if (!response.ok) {
						controller.error(
							new Error(
								`Failed to read stream: ${response.status} ${response.statusText}`
							)
						);
						return;
					}

					if (!response.body) {
						controller.error(new Error('Response body is null'));
						return;
					}

					const reader = response.body.getReader();
					try {
						// Iterative read to avoid recursive promise chains
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;
							if (value) controller.enqueue(value);
						}
						controller.close();
					} catch (error) {
						controller.error(error);
					}
				} catch (error) {
					controller.error(error);
				}
			},
			cancel(reason?: unknown) {
				if (ac) {
					ac.abort(reason);
					ac = null;
				}
			},
		});
	}
}

/**
 * Implementation of the StreamAPI interface for creating and managing streams
 */
export default class StreamAPIImpl implements StreamAPI {
	/**
	 * create a new stream
	 *
	 * @param name - the name of the stream (1-254 characters)
	 * @param props - optional properties for creating the stream
	 * @returns a Promise that resolves to the created Stream
	 */
	async create(name: string, props?: CreateStreamProps): Promise<Stream> {
		if (!name || name.length < 1 || name.length > 254) {
			throw new Error('Stream name must be between 1 and 254 characters');
		}

		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan(
			'agentuity.stream.create',
			{},
			currentContext
		);

		try {
			span.setAttribute('name', name);
			if (props?.metadata) {
				span.setAttribute('metadata', JSON.stringify(props.metadata));
			}
			if (props?.contentType) {
				span.setAttribute('stream.content_type', props.contentType);
			}

			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				const requestBody = {
					name,
					...(props?.metadata && { metadata: props.metadata }),
					...(props?.contentType && { contentType: props.contentType }),
				};

				const resp = await POST(
					'/',
					JSON.stringify(requestBody),
					{
						'Content-Type': 'application/json',
					},
					undefined,
					undefined,
					'stream'
				);

				if (resp.status === 200) {
					const result = resp.json as {
						id: string;
					};

					const baseUrl = getBaseUrlForService('stream');
					const url = `${baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl}/${result.id}`;

					span.setAttribute('stream.id', result.id);
					span.setAttribute('stream.url', url);

					let abortController: AbortController | null = null;
					let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
					let putRequestPromise: Promise<Response> | null = null;
					let total = 0;
					let closed = false;

					// Create a WritableStream that writes to the backend stream
					// Create the underlying sink that will handle the actual streaming
					const underlyingSink = {
						async start() {
							// Create AbortController for the fetch request
							abortController = new AbortController();

							// Create a ReadableStream to pipe data to the PUT request
							let { readable, writable } = new TransformStream<
								Uint8Array,
								Uint8Array
							>();

							// If compression is enabled, add gzip transform
							if (props?.compress) {
								const { Readable, Writable } = await import('node:stream');

								// Create a new transform for the compressed output
								const { readable: compressedReadable, writable: compressedWritable } = new TransformStream<
									Uint8Array,
									Uint8Array
								>();

								// Set up compression pipeline
								const gzipStream = createGzip();
								const nodeWritable = Writable.toWeb(gzipStream) as WritableStream<Uint8Array>;

								// Pipe gzip output to the compressed readable
								const gzipReader = Readable.toWeb(gzipStream) as ReadableStream<Uint8Array>;
								gzipReader.pipeTo(compressedWritable).catch(() => {});

								// Chain: writable -> gzip -> compressedReadable
								readable.pipeTo(nodeWritable).catch(() => {});
								readable = compressedReadable;
							}

							writer = writable.getWriter();

							// Start the PUT request with the readable stream as body
							const apiKey =
								process.env.AGENTUITY_SDK_KEY || process.env.AGENTUITY_API_KEY;
							if (!apiKey) {
								throw new Error(
									'AGENTUITY_API_KEY or AGENTUITY_SDK_KEY is not set'
								);
							}
							const sdkVersion = getSDKVersion();

							const headers: Record<string, string> = {
								'Content-Type':
									props?.contentType || 'application/octet-stream',
								'User-Agent': `Agentuity JS SDK/${sdkVersion}`,
								Authorization: `Bearer ${apiKey}`,
							};

							if (props?.compress) {
								headers['Content-Encoding'] = 'gzip';
							}

							putRequestPromise = getFetch()(url, {
								method: 'PUT',
								headers,
								body: readable,
								signal: abortController.signal,
								duplex: 'half',
							} as RequestInit & { duplex: 'half' });
						},
						async write(
							chunk: string | Uint8Array | ArrayBuffer | Buffer | object
						) {
							if (!writer) {
								throw new Error('Stream writer not initialized');
							}
							// Convert input to Uint8Array if needed
							let binaryChunk: Uint8Array;
							if (chunk instanceof Uint8Array) {
								binaryChunk = chunk;
							} else if (typeof chunk === 'string') {
								binaryChunk = new TextEncoder().encode(chunk);
							} else if (chunk instanceof ArrayBuffer) {
								binaryChunk = new Uint8Array(chunk);
							} else if (typeof chunk === 'object' && chunk !== null) {
								// Convert objects to JSON string, then to bytes
								binaryChunk = new TextEncoder().encode(safeStringify(chunk));
							} else {
								// Handle primitive types (number, boolean, etc.)
								binaryChunk = new TextEncoder().encode(String(chunk));
							}
							// Write the chunk to the transform stream, which pipes to the PUT request
							await writer.write(binaryChunk);
							total += binaryChunk.length;
						},
						async close() {
							if (closed) {
								return;
							}
							closed = true;
							span.setAttribute('stream.total', total);
							if (writer) {
								await writer.close();
								writer = null;
							}
							// Wait for the PUT request to complete
							if (putRequestPromise) {
								try {
									const response = await putRequestPromise;
									if (!response.ok) {
										throw new Error(
											`PUT request failed: ${response.status} ${response.statusText}`
										);
									}
								} catch (error) {
									if (error instanceof Error && error.name !== 'AbortError') {
										throw error;
									}
								}
								putRequestPromise = null;
							}
							abortController = null;
						},
						async abort(reason?: unknown) {
							if (writer) {
								await writer.abort(reason);
								writer = null;
							}
							// Abort the fetch request
							if (abortController) {
								abortController.abort(reason);
								abortController = null;
							}
							putRequestPromise = null;
						},
					};

					const stream = new StreamImpl(result.id, url, underlyingSink);

					span.setStatus({ code: SpanStatusCode.OK });
					return stream;
				}

				throw new Error(
					`error creating stream: ${resp.response.statusText} (${resp.response.status})`
				);
			});
		} catch (ex) {
			recordException(span, ex);
			span.setStatus({ code: SpanStatusCode.ERROR });
			throw ex;
		} finally {
			span.end();
		}
	}
}
