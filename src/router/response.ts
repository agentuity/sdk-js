import type {
	AgentResponse,
	InvocationArguments,
	GetAgentRequestParams,
	AgentResponseData,
	JsonObject,
	DataType,
	AgentRedirectResponse,
	ReadableDataType,
} from '../types';
import { isJsonObject } from '../types';
import { ReadableStream } from 'node:stream/web';
import { DataHandler } from './data';
import { safeStringify, fromDataType } from '../server/util';

/**
 * The AgentResponse class implements the AgentResponseHandler interface.
 * It is used to create and return responses from an agent.
 */
export default class AgentResponseHandler implements AgentResponse {
	/**
	 * redirect the current request another agent within the same project
	 */
	async handoff<M = unknown>(
		agent: GetAgentRequestParams,
		args?: InvocationArguments
	): Promise<AgentRedirectResponse> {
		if (isJsonObject(args?.metadata)) {
			const result: AgentRedirectResponse = {
				redirect: true,
				agent,
				invocation: args as JsonObject,
			};
			return result;
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return an empty response with optional metadata
	 */
	async empty<M = unknown>(metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return {
				data: new DataHandler('', 'text/plain'),
				metadata,
			};
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a JSON response with optional metadata
	 */
	async json<T = unknown, M = unknown>(
		data: T,
		metadata?: M
	): Promise<AgentResponseData> {
		if (!isJsonObject(data)) {
			throw new Error('data must be a JsonObject');
		}
		if (isJsonObject(metadata)) {
			return {
				data: new DataHandler(safeStringify(data), 'application/json'),
				metadata,
			};
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a text response with optional metadata
	 */
	async text<M = unknown>(
		data: string,
		metadata?: M
	): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return {
				data: new DataHandler(data, 'text/plain'),
				metadata,
			};
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a binary response with optional metadata
	 */
	binary<M = unknown>(
		data: DataType,
		metadata?: M
	): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'application/octet-stream', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a PDF response with optional metadata
	 */
	pdf<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'application/pdf', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a PNG response with optional metadata
	 */
	png<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'image/png', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a JPEG response with optional metadata
	 */
	jpeg<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'image/jpeg', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a GIF response with optional metadata
	 */
	gif<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'image/gif', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a WebP response with optional metadata
	 */
	webp<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'image/webp', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a MP3 response with optional metadata
	 */
	mp3<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'audio/mpeg', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a MP4 response with optional metadata
	 */
	mp4<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'audio/mp4', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a M4A response with optional metadata
	 */
	m4a<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'audio/m4a', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a M4P response with optional metadata
	 */
	m4p<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'audio/m4p', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a WebM response with optional metadata
	 */
	webm<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'audio/webm', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a HTML response with optional metadata
	 */
	async html<M = unknown>(
		data: string,
		metadata?: M
	): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return {
				data: new DataHandler(data, 'text/html'),
				metadata,
			};
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a WAV response with optional metadata
	 */
	wav<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'audio/wav', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return an OGG response with optional metadata
	 */
	ogg<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'audio/ogg', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * helper method to check if an item is a ReadableDataType
	 */
	private isReadableDataType(item: unknown): item is ReadableDataType {
		return (
			typeof item === 'string' ||
			item instanceof Buffer ||
			item instanceof Uint8Array ||
			item instanceof ArrayBuffer ||
			item instanceof Blob
		);
	}

	/**
	 * helper method to check if a result is a generator
	 */
	private isGenerator<U>(result: any): result is Generator<U, void, unknown> {
		return (
			result &&
			typeof result === 'object' &&
			typeof result.next === 'function' &&
			typeof result[Symbol.iterator] === 'function'
		);
	}

	/**
	 * helper method to process transformer result - handles both single values and generators
	 */
	private processTransformerResult<U>(
		result: U | Generator<U, void, unknown> | null | undefined
	): U | null | undefined {
		if (result === null || result === undefined) {
			return result; // Pass through null/undefined to skip
		}

		if (this.isGenerator(result)) {
			// It's a generator, get the first (and only expected) value
			const firstResult = result.next();
			if (firstResult.done || firstResult.value === undefined) {
				return null; // Generator yielded nothing, skip this item
			}
			return firstResult.value;
		} else {
			// It's a single value, return it as-is
			return result as U;
		}
	}

	/**
	 * stream a response to the client
	 */
	async stream<T = unknown, U = T, M = unknown>(
		stream: ReadableStream<T> | AsyncIterable<T>,
		contentType?: string,
		metadata?: M,
		transformer?:
			| ((item: T) => U | null | undefined)
			| ((item: T) => Generator<U, void, unknown>)
	): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			// Determine if we need to convert objects to JSON by checking the first item
			const result = await this.processStreamForAutoConversion(
				stream,
				contentType,
				transformer
			);

			return {
				data: new DataHandler(result.stream, result.contentType),
				metadata,
			};
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * Process stream to detect if auto-conversion is needed and apply it
	 */
	private async processStreamForAutoConversion<T, U>(
		stream: ReadableStream<T> | AsyncIterable<T>,
		contentType?: string,
		transformer?:
			| ((item: T) => U | null | undefined)
			| ((item: T) => Generator<U, void, unknown>)
	): Promise<{
		stream: ReadableStream<ReadableDataType> | AsyncIterable<ReadableDataType>;
		contentType: string;
	}> {
		// For ReadableStream, we need to peek at the first item to determine conversion
		if (stream instanceof ReadableStream) {
			return this.processReadableStreamForAutoConversion(
				stream,
				contentType,
				transformer
			);
		} else {
			// For AsyncIterable, we can create a new async generator that checks on first item
			return this.processAsyncIterableForAutoConversion(
				stream,
				contentType,
				transformer
			);
		}
	}

	/**
	 * Process ReadableStream for auto-conversion
	 */
	private async processReadableStreamForAutoConversion<T, U>(
		stream: ReadableStream<T>,
		contentType?: string,
		transformer?:
			| ((item: T) => U | null | undefined)
			| ((item: T) => Generator<U, void, unknown>)
	): Promise<{
		stream: ReadableStream<ReadableDataType>;
		contentType: string;
	}> {
		const reader = stream.getReader();
		let firstTransformedItem: U | null | undefined;
		let done = false;

		// Read and transform the first item to determine conversion strategy
		try {
			let foundFirstItem = false;
			while (!foundFirstItem && !done) {
				const result = await reader.read();
				done = result.done;

				if (!done && result.value !== undefined) {
					if (transformer) {
						const transformResult = transformer(result.value);
						firstTransformedItem =
							this.processTransformerResult(transformResult);
						// Keep reading until we get a non-null/undefined result or reach the end
						if (
							firstTransformedItem !== null &&
							firstTransformedItem !== undefined
						) {
							foundFirstItem = true;
						}
					} else {
						firstTransformedItem = result.value as unknown as U;
						foundFirstItem = true;
					}
				}
			}
		} catch (error) {
			reader.releaseLock();
			throw error;
		}

		// Determine if we need JSON conversion based on first transformed item
		const needsJsonConversion =
			firstTransformedItem !== undefined &&
			firstTransformedItem !== null &&
			!this.isReadableDataType(firstTransformedItem);
		const finalContentType =
			needsJsonConversion && !contentType
				? 'application/json'
				: (contentType ?? 'application/octet-stream');

		// Create a new ReadableStream that handles the conversion
		const convertedStream = new ReadableStream<ReadableDataType>({
			start: async (controller) => {
				try {
					// Handle the first transformed item if we have one
					if (
						!done &&
						firstTransformedItem !== null &&
						firstTransformedItem !== undefined
					) {
						if (needsJsonConversion) {
							const jsonString = JSON.stringify(firstTransformedItem) + '\n';
							controller.enqueue(new TextEncoder().encode(jsonString));
						} else {
							controller.enqueue(firstTransformedItem as ReadableDataType);
						}
					}

					// Process remaining items
					while (true) {
						const { done: nextDone, value } = await reader.read();
						if (nextDone) break;

						// Apply transformer if provided
						let processedValue: U | null | undefined;
						if (transformer) {
							const transformResult = transformer(value);
							processedValue = this.processTransformerResult(transformResult);
							// Skip null/undefined values
							if (processedValue === null || processedValue === undefined) {
								continue;
							}
						} else {
							processedValue = value as unknown as U;
						}

						if (needsJsonConversion) {
							const jsonString = JSON.stringify(processedValue) + '\n';
							controller.enqueue(new TextEncoder().encode(jsonString));
						} else {
							controller.enqueue(processedValue as ReadableDataType);
						}
					}
				} catch (error) {
					controller.error(error);
				} finally {
					controller.close();
					reader.releaseLock();
				}
			},
		});

		return {
			stream: convertedStream,
			contentType: finalContentType,
		};
	}

	/**
	 * Process AsyncIterable for auto-conversion
	 */
	private async processAsyncIterableForAutoConversion<T, U>(
		stream: AsyncIterable<T>,
		contentType?: string,
		transformer?:
			| ((item: T) => U | null | undefined)
			| ((item: T) => Generator<U, void, unknown>)
	): Promise<{ stream: AsyncIterable<ReadableDataType>; contentType: string }> {
		const self = this;

		// We need to peek at the first item to determine conversion strategy
		const iterator = stream[Symbol.asyncIterator]();
		let firstTransformedItem: U | null | undefined;
		let firstResult: IteratorResult<T>;

		// Find the first valid transformed item
		do {
			firstResult = await iterator.next();
			if (firstResult.done) break;

			if (transformer) {
				const transformResult = transformer(firstResult.value);
				firstTransformedItem = self.processTransformerResult(transformResult);
				// Continue until we find a non-null/undefined result
				if (
					firstTransformedItem !== null &&
					firstTransformedItem !== undefined
				) {
					break;
				}
			} else {
				firstTransformedItem = firstResult.value as unknown as U;
				break;
			}
		} while (!firstResult.done);

		// Determine if we need JSON conversion based on first transformed item
		const needsJsonConversion =
			!firstResult.done &&
			firstTransformedItem !== null &&
			firstTransformedItem !== undefined &&
			!self.isReadableDataType(firstTransformedItem);
		const finalContentType =
			needsJsonConversion && !contentType
				? 'application/json'
				: (contentType ?? 'application/octet-stream');

		const convertedStream = (async function* () {
			// Handle the first transformed item if we have one
			if (
				!firstResult.done &&
				firstTransformedItem !== null &&
				firstTransformedItem !== undefined
			) {
				if (needsJsonConversion) {
					const jsonString = JSON.stringify(firstTransformedItem) + '\n';
					yield new TextEncoder().encode(jsonString);
				} else {
					yield firstTransformedItem as ReadableDataType;
				}
			}

			// Process remaining items
			while (true) {
				const result = await iterator.next();
				if (result.done) break;

				// Apply transformer if provided
				let processedValue: U | null | undefined;
				if (transformer) {
					const transformResult = transformer(result.value);
					processedValue = self.processTransformerResult(transformResult);
					// Skip null/undefined values
					if (processedValue === null || processedValue === undefined) {
						continue;
					}
				} else {
					processedValue = result.value as unknown as U;
				}

				if (needsJsonConversion) {
					const jsonString = JSON.stringify(processedValue) + '\n';
					yield new TextEncoder().encode(jsonString);
				} else {
					yield processedValue as ReadableDataType;
				}
			}
		})();

		return {
			stream: convertedStream,
			contentType: finalContentType,
		};
	}

	/**
	 * return a response with specific data and content type with optional metadata
	 */
	data<M = unknown>(
		data: DataType,
		contentType: string,
		metadata?: M
	): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, contentType, metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a markdown response with optional metadata
	 */
	async markdown<M = unknown>(
		content: string,
		metadata?: M
	): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return {
				data: new DataHandler(content, 'text/markdown'),
				metadata,
			};
		}
		throw new Error('metadata must be a JsonObject');
	}
}
