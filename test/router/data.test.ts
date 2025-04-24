import { describe, expect, it } from 'bun:test';
import { DataHandler } from '../../src/router/data';
import '../setup'; // Import global test setup

describe('DataHandler', () => {
	describe('constructor', () => {
		it('should initialize with payload and content type', () => {
			const handler = new DataHandler(
				Buffer.from('Hello, world!'),
				'text/plain'
			);
			expect(handler.contentType).toBe('text/plain');
		});

		it('should default to application/octet-stream if no content type provided', () => {
			const handler = new DataHandler(
				Buffer.from('Hello, world!'),
				undefined as unknown as string
			);
			expect(handler.contentType).toBe('application/octet-stream');
		});
	});

	describe('text property', () => {
		it('should decode base64 payload to text', () => {
			const text = 'Hello, world!';
			const handler = new DataHandler(Buffer.from(text), 'text/plain');
			expect(handler.text()).resolves.toBe(text);
		});

		it('should handle empty payload', () => {
			const handler = new DataHandler('', 'text/plain');
			expect(handler.text()).resolves.toBe('');
		});
	});

	describe('json property', () => {
		it('should parse JSON payload correctly', () => {
			const jsonData = { message: 'Hello, world!' };
			const jsonString = JSON.stringify(jsonData);
			const payload = Buffer.from(jsonString);

			const handler = new DataHandler(payload, 'application/json');

			expect(handler.text()).resolves.toBe(jsonString);
			expect(handler.json()).resolves.toHaveProperty(
				'message',
				'Hello, world!'
			);
		});

		it('should handle invalid JSON gracefully', () => {
			const handler = new DataHandler(
				Buffer.from('invalid json'),
				'application/json'
			);

			const result = handler.json();
			expect(result).rejects.toThrow('The content type is not valid JSON');
		});
	});

	describe('binary property', () => {
		it('should return Uint8Array from payload', () => {
			const binaryData = new Uint8Array([1, 2, 3, 4]);
			const handler = new DataHandler(
				Buffer.from(binaryData),
				'application/octet-stream'
			);

			const result = handler.binary();
			expect(result).resolves.toBeInstanceOf(Uint8Array);
			expect(result).resolves.toHaveLength(4);
		});
	});

	describe('object method', () => {
		it('should return typed object from JSON payload', () => {
			interface TestData {
				message: string;
				count: number;
			}

			const jsonData = { message: 'Hello, world!', count: 42 };
			const jsonString = JSON.stringify(jsonData);
			const payload = Buffer.from(jsonString);

			const handler = new DataHandler(payload, 'application/json');

			const text = handler.text();
			expect(text).resolves.toBeDefined();
			expect(text).resolves.toBe(jsonString);

			const result = handler.object<TestData>();
			expect(result).resolves.toBeDefined();
			expect(result).resolves.toBeInstanceOf(Object);
			expect(result).resolves.toHaveProperty('message', 'Hello, world!');
			expect(result).resolves.toHaveProperty('count', 42);
		});
	});
});
