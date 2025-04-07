import { describe, expect, it, beforeEach } from 'bun:test';
import AgentResponseHandler from '../../src/router/response';
import { ReadableStream } from 'node:stream/web';
import '../setup'; // Import global test setup

describe('AgentResponseHandler Streaming', () => {
	let responseHandler: AgentResponseHandler;

	beforeEach(() => {
		responseHandler = new AgentResponseHandler();
	});

	describe('stream method', () => {
		it('should create a response with a ReadableStream', async () => {
			const testData = ['Hello', 'World'];
			const stream = new ReadableStream({
				start(controller) {
					for (const chunk of testData) {
						controller.enqueue(chunk);
					}
					controller.close();
				},
			});

			const result = await responseHandler.stream(stream);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe('text/plain');
			expect(result.data.stream).toBe(stream);
		});

		it('should use custom content type when provided', async () => {
			const testData = ['Hello', 'World'];
			const stream = new ReadableStream({
				start(controller) {
					for (const chunk of testData) {
						controller.enqueue(chunk);
					}
					controller.close();
				},
			});

			const contentType = 'application/json';
			const result = await responseHandler.stream(stream, contentType);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe(contentType);
			expect(result.data.stream).toBe(stream);
		});

		it('should handle AsyncIterable input', async () => {
			async function* generateData() {
				yield 'Hello';
				yield 'World';
			}

			const asyncIterable = generateData();
			const result = await responseHandler.stream(asyncIterable);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe('text/plain');
			expect(result.data.stream).toBeDefined();
		});

		it('should handle empty streams', async () => {
			const emptyStream = new ReadableStream({
				start(controller) {
					controller.close();
				},
			});

			const result = await responseHandler.stream(emptyStream);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe('text/plain');
			expect(result.data.stream).toBe(emptyStream);
		});

		it('should handle binary data in streams', async () => {
			const binaryData = new Uint8Array([1, 2, 3, 4]);
			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue(binaryData);
					controller.close();
				},
			});

			const contentType = 'application/octet-stream';
			const result = await responseHandler.stream(stream, contentType);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe(contentType);
			expect(result.data.stream).toBe(stream);
		});
	});
});
