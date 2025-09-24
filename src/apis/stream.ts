import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { getTracer, recordException } from '../router/router';
import type { CreateStreamProps, Stream, StreamAPI } from '../types';
import { POST, getBaseUrlForService } from './api';

/**
 * A writable stream implementation that extends WritableStream
 */
class StreamImpl extends WritableStream implements Stream {
	public readonly id: string;
	public readonly url: string;

	constructor(id: string, url: string, underlyingStream: WritableStream) {
		super(underlyingStream);
		this.id = id;
		this.url = url;
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

			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				const requestBody = {
					name,
					...(props?.metadata && { metadata: props.metadata }),
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
					const result = (await resp.response.json()) as {
						id: string;
					};

					const baseUrl = getBaseUrlForService('stream');
					const url = `${baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl}/${result.id}`;

					span.setAttribute('stream.id', result.id);
					span.setAttribute('stream.url', url);

					let abortController: AbortController | null = null;
					let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
					let putRequestPromise: Promise<Response> | null = null;

					// Create a WritableStream that writes to the backend stream
					const underlyingStream = new WritableStream({
						async start() {
							// Create AbortController for the fetch request
							abortController = new AbortController();

							// Create a ReadableStream to pipe data to the PUT request
							const { readable, writable } = new TransformStream();
							writer = writable.getWriter();

							// Start the PUT request with the readable stream as body
							putRequestPromise = fetch(url, {
								method: 'PUT',
								headers: {
									'Content-Type': 'application/octet-stream',
								},
								body: readable,
								signal: abortController.signal,
								duplex: 'half',
							} as RequestInit & { duplex: 'half' });
						},
						async write(chunk: Uint8Array) {
							if (!writer) {
								throw new Error('Stream writer not initialized');
							}
							// Write the chunk to the transform stream, which pipes to the PUT request
							await writer.write(chunk);
						},
						async close() {
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
					});

					const stream = new StreamImpl(result.id, url, underlyingStream);

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
