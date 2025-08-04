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
			expect(result.data.contentType).toBe('application/octet-stream');
			expect(result.data.stream()).resolves.toBeInstanceOf(ReadableStream);
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
			expect(result.data.stream()).resolves.toBeInstanceOf(ReadableStream);
		});

		it('should handle AsyncIterable input', async () => {
			async function* generateData() {
				yield 'Hello';
				yield 'World';
			}

			const asyncIterable = generateData();
			const result = await responseHandler.stream(asyncIterable);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe('application/octet-stream');
			expect(result.data.stream()).resolves.toBeInstanceOf(ReadableStream);
		});

		it('should handle empty streams', async () => {
			const emptyStream = new ReadableStream({
				start(controller) {
					controller.close();
				},
			});

			const result = await responseHandler.stream(emptyStream);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe('application/octet-stream');
			expect(result.data.stream()).resolves.toBeInstanceOf(ReadableStream);
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
			expect(result.data.stream()).resolves.toBeInstanceOf(ReadableStream);
		});

		it('should auto-convert object streams to JSON newline format', async () => {
			const testObjects = [
				{ name: 'Hero1', class: 'Warrior' },
				{ name: 'Hero2', class: 'Mage' },
			];

			const stream = new ReadableStream({
				start(controller) {
					for (const obj of testObjects) {
						controller.enqueue(obj);
					}
					controller.close();
				},
			});

			const result = await responseHandler.stream(stream);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe('application/json');

			// Read the stream to verify content
			const resultStream = await result.data.stream();
			const reader = resultStream.getReader();
			const chunks: Uint8Array[] = [];

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(value as Uint8Array);
			}

			const decoder = new TextDecoder();
			const combined = new Uint8Array(
				chunks.reduce((acc, chunk) => acc + chunk.length, 0)
			);
			let offset = 0;
			for (const chunk of chunks) {
				combined.set(chunk, offset);
				offset += chunk.length;
			}

			const output = decoder.decode(combined);
			const lines = output.split('\n').filter((line) => line.length > 0);

			expect(lines).toHaveLength(2);
			expect(JSON.parse(lines[0])).toEqual(testObjects[0]);
			expect(JSON.parse(lines[1])).toEqual(testObjects[1]);
		});

		it('should auto-convert AsyncIterable objects to JSON newline format', async () => {
			async function* generateObjects() {
				yield { id: 1, message: 'First' };
				yield { id: 2, message: 'Second' };
			}

			const result = await responseHandler.stream(generateObjects());

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe('application/json');
		});

		it('should respect custom content type even for objects', async () => {
			const testObjects = [{ data: 'test' }];

			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue(testObjects[0]);
					controller.close();
				},
			});

			const customContentType = 'application/x-ndjson';
			const result = await responseHandler.stream(stream, customContentType);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe(customContentType);
		});

		it('should maintain backward compatibility with ReadableDataType streams', async () => {
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
			expect(result.data.contentType).toBe('application/octet-stream');
		});

		it('should handle mixed ReadableDataType and object detection correctly', async () => {
			// Test with Buffer (should be treated as ReadableDataType)
			const bufferStream = new ReadableStream({
				start(controller) {
					controller.enqueue(Buffer.from('test'));
					controller.close();
				},
			});

			const bufferResult = await responseHandler.stream(bufferStream);
			expect(bufferResult.data.contentType).toBe('application/octet-stream');

			// Test with objects (should be converted to JSON)
			const objectStream = new ReadableStream({
				start(controller) {
					controller.enqueue({ test: 'value' });
					controller.close();
				},
			});

			const objectResult = await responseHandler.stream(objectStream);
			expect(objectResult.data.contentType).toBe('application/json');
		});

		it('should handle empty object streams', async () => {
			// Create an empty async iterable
			const emptyAsyncIterable = {
				async *[Symbol.asyncIterator]() {
					// Empty generator - yields nothing
				},
			};

			const result = await responseHandler.stream(emptyAsyncIterable);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe('application/octet-stream'); // Should use default since no items to detect
		});

		// Transformer functionality tests
		it('should transform objects using transformer function', async () => {
			const testObjects = [
				{ id: 1, name: 'Alice', active: true },
				{ id: 2, name: 'Bob', active: false },
				{ id: 3, name: 'Charlie', active: true },
			];

			const stream = new ReadableStream({
				start(controller) {
					for (const obj of testObjects) {
						controller.enqueue(obj);
					}
					controller.close();
				},
			});

			// Transform to only include active users and simplify structure
			const transformer = (item: {
				id: number;
				name: string;
				active: boolean;
			}) => {
				if (!item.active) return null; // Filter out inactive users
				return { name: item.name, id: item.id };
			};

			const result = await responseHandler.stream(
				stream,
				undefined,
				{},
				transformer
			);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe('application/json');

			// Read the stream to verify content
			const resultStream = await result.data.stream();
			const reader = resultStream.getReader();
			const chunks: Uint8Array[] = [];

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(value as Uint8Array);
			}

			const decoder = new TextDecoder();
			const combined = new Uint8Array(
				chunks.reduce((acc, chunk) => acc + chunk.length, 0)
			);
			let offset = 0;
			for (const chunk of chunks) {
				combined.set(chunk, offset);
				offset += chunk.length;
			}

			const output = decoder.decode(combined);
			const lines = output.split('\n').filter((line) => line.length > 0);

			// Should only have 2 lines (Alice and Charlie, Bob filtered out)
			expect(lines).toHaveLength(2);
			expect(JSON.parse(lines[0])).toEqual({ name: 'Alice', id: 1 });
			expect(JSON.parse(lines[1])).toEqual({ name: 'Charlie', id: 3 });
		});

		it('should work with transformer on AsyncIterable', async () => {
			async function* generateNumbers() {
				for (let i = 1; i <= 5; i++) {
					yield i;
				}
			}

			// Transform numbers to objects, filter out even numbers
			const transformer = (num: number) => {
				if (num % 2 === 0) return null; // Filter out even numbers
				return { value: num, isOdd: true };
			};

			const result = await responseHandler.stream(
				generateNumbers(),
				undefined,
				{},
				transformer
			);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe('application/json');
		});

		it('should handle transformer that returns ReadableDataType', async () => {
			const testNumbers = [1, 2, 3, 4, 5];

			const stream = new ReadableStream({
				start(controller) {
					for (const num of testNumbers) {
						controller.enqueue(num);
					}
					controller.close();
				},
			});

			// Transform numbers to strings (ReadableDataType)
			const transformer = (num: number) => {
				if (num % 2 === 0) return undefined; // Filter out even numbers
				return `Number: ${num}`;
			};

			const result = await responseHandler.stream(
				stream,
				undefined,
				{},
				transformer
			);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe('application/octet-stream'); // Should detect string as ReadableDataType
		});

		it('should handle transformer that always returns null', async () => {
			const testData = [1, 2, 3];

			const stream = new ReadableStream({
				start(controller) {
					for (const item of testData) {
						controller.enqueue(item);
					}
					controller.close();
				},
			});

			// Transformer that filters out everything
			const transformer = () => null;

			const result = await responseHandler.stream(
				stream,
				undefined,
				{},
				transformer
			);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe('application/octet-stream'); // Default since no valid items found
		});

		it('should maintain custom content type with transformer', async () => {
			const testData = [{ id: 1 }, { id: 2 }];

			const stream = new ReadableStream({
				start(controller) {
					for (const item of testData) {
						controller.enqueue(item);
					}
					controller.close();
				},
			});

			const transformer = (item: { id: number }) => ({ transformed: item.id });
			const customContentType = 'application/x-custom-json';

			const result = await responseHandler.stream(
				stream,
				customContentType,
				{},
				transformer
			);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe(customContentType);
		});

		it('should work without transformer (backward compatibility)', async () => {
			const testData = ['hello', 'world'];

			const stream = new ReadableStream({
				start(controller) {
					for (const item of testData) {
						controller.enqueue(item);
					}
					controller.close();
				},
			});

			// No transformer provided
			const result = await responseHandler.stream(stream, undefined, {});

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe('application/octet-stream');
		});

		it('should handle transformer errors gracefully', async () => {
			const testData = [1, 2, 3];

			const stream = new ReadableStream({
				start(controller) {
					for (const item of testData) {
						controller.enqueue(item);
					}
					controller.close();
				},
			});

			// Transformer that throws an error
			const transformer = (item: number) => {
				if (item === 2) throw new Error('Transform error');
				return { value: item };
			};

			// The stream() call succeeds, but reading the stream should fail
			const result = await responseHandler.stream(
				stream,
				undefined,
				{},
				transformer
			);
			expect(result.data).toBeDefined();

			// The error should occur when trying to read the stream
			const resultStream = await result.data.stream();
			const reader = resultStream.getReader();

			// Should throw an error when reading
			const readPromise = (async () => {
				while (true) {
					const { done } = await reader.read();
					if (done) break;
				}
			})();

			await expect(readPromise).rejects.toThrow();
		});

		it('should handle complex data transformation', async () => {
			interface User {
				id: number;
				firstName: string;
				lastName: string;
				email: string;
				age: number;
			}

			const users: User[] = [
				{
					id: 1,
					firstName: 'John',
					lastName: 'Doe',
					email: 'john@example.com',
					age: 25,
				},
				{
					id: 2,
					firstName: 'Jane',
					lastName: 'Smith',
					email: 'jane@example.com',
					age: 17,
				},
				{
					id: 3,
					firstName: 'Bob',
					lastName: 'Johnson',
					email: 'bob@example.com',
					age: 30,
				},
			];

			const stream = new ReadableStream({
				start(controller) {
					for (const user of users) {
						controller.enqueue(user);
					}
					controller.close();
				},
			});

			// Transform to only include adults and format output
			const transformer = (user: User) => {
				if (user.age < 18) return null; // Filter out minors
				return {
					fullName: `${user.firstName} ${user.lastName}`,
					contact: user.email,
					isAdult: true,
				};
			};

			const result = await responseHandler.stream(
				stream,
				undefined,
				{},
				transformer
			);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe('application/json');
		});

		// Generator function tests
		it('should work with generator function transformer', async () => {
			const testData = [1, 2, 3, 4, 5];

			const stream = new ReadableStream({
				start(controller) {
					for (const item of testData) {
						controller.enqueue(item);
					}
					controller.close();
				},
			});

			// Generator function that transforms numbers
			function* transformer(num: number) {
				if (num % 2 === 0) return; // Skip even numbers (generator yields nothing)
				yield { value: num, isOdd: true };
			}

			const result = await responseHandler.stream(
				stream,
				undefined,
				{},
				transformer
			);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe('application/json');
		});

		it('should work with generator function on AsyncIterable', async () => {
			async function* generateNumbers() {
				for (let i = 1; i <= 5; i++) {
					yield i;
				}
			}

			// Generator transformer that doubles numbers
			function* transformer(num: number) {
				yield num * 2;
			}

			const result = await responseHandler.stream(
				generateNumbers(),
				undefined,
				{},
				transformer
			);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe('application/json'); // numbers are treated as objects, not ReadableDataType
		});

		it('should handle generator that yields string (ReadableDataType)', async () => {
			const testData = [1, 2, 3];

			const stream = new ReadableStream({
				start(controller) {
					for (const item of testData) {
						controller.enqueue(item);
					}
					controller.close();
				},
			});

			// Generator that yields formatted strings
			function* transformer(num: number) {
				yield `Number: ${num}`;
			}

			const result = await responseHandler.stream(
				stream,
				undefined,
				{},
				transformer
			);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe('application/octet-stream'); // strings are ReadableDataType
		});

		it('should handle generator that filters (yields nothing)', async () => {
			const testData = [1, 2, 3, 4];

			const stream = new ReadableStream({
				start(controller) {
					for (const item of testData) {
						controller.enqueue(item);
					}
					controller.close();
				},
			});

			// Generator that filters out all even numbers
			function* transformer(num: number) {
				if (num % 2 === 0) return; // Don't yield anything for even numbers
				yield { value: num };
			}

			const result = await responseHandler.stream(
				stream,
				undefined,
				{},
				transformer
			);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe('application/json');
		});

		it('should handle generator with custom content type', async () => {
			const testData = [{ id: 1 }, { id: 2 }];

			const stream = new ReadableStream({
				start(controller) {
					for (const item of testData) {
						controller.enqueue(item);
					}
					controller.close();
				},
			});

			// Generator that transforms objects
			function* transformer(item: { id: number }) {
				yield { transformed: item.id, timestamp: Date.now() };
			}

			const customContentType = 'application/x-custom-stream';
			const result = await responseHandler.stream(
				stream,
				customContentType,
				{},
				transformer
			);

			expect(result.data).toBeDefined();
			expect(result.data.contentType).toBe(customContentType);
		});

		it('should handle generator errors gracefully', async () => {
			const testData = [1, 2, 3];

			const stream = new ReadableStream({
				start(controller) {
					for (const item of testData) {
						controller.enqueue(item);
					}
					controller.close();
				},
			});

			// Generator that throws an error
			function* transformer(num: number) {
				if (num === 2) throw new Error('Generator error');
				yield { value: num };
			}

			const result = await responseHandler.stream(
				stream,
				undefined,
				{},
				transformer
			);
			expect(result.data).toBeDefined();

			// The error should occur when reading the stream
			const resultStream = await result.data.stream();
			const reader = resultStream.getReader();

			const readPromise = (async () => {
				while (true) {
					const { done } = await reader.read();
					if (done) break;
				}
			})();

			await expect(readPromise).rejects.toThrow();
		});

		it('should handle mixed regular function and generator scenarios', async () => {
			// Test that both regular functions and generators work in different calls
			const testData = [1, 2, 3];

			// Test with regular function
			const regularStream = new ReadableStream({
				start(controller) {
					for (const item of testData) {
						controller.enqueue(item);
					}
					controller.close();
				},
			});

			const regularTransformer = (num: number) => num * 2;
			const regularResult = await responseHandler.stream(
				regularStream,
				undefined,
				{},
				regularTransformer
			);
			expect(regularResult.data.contentType).toBe('application/json'); // numbers are treated as objects

			// Test with generator function
			const generatorStream = new ReadableStream({
				start(controller) {
					for (const item of testData) {
						controller.enqueue(item);
					}
					controller.close();
				},
			});

			function* generatorTransformer(num: number) {
				yield num * 2;
			}

			const generatorResult = await responseHandler.stream(
				generatorStream,
				undefined,
				{},
				generatorTransformer
			);
			expect(generatorResult.data.contentType).toBe('application/json'); // numbers are treated as objects
		});
	});
});
