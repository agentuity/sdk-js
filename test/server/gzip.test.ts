import { describe, expect, it } from 'bun:test';
import { gzipBuffer, gunzipBuffer } from '../../src/server/gzip';
import '../setup'; // Import global test setup

describe('Compression Utilities', () => {
	describe('gzipBuffer', () => {
		it('should compress a simple string', async () => {
			const testString = Buffer.from('Hello, world!');
			const compressed = await gzipBuffer(testString);

			expect(compressed).toBeInstanceOf(Buffer);
			expect(compressed.length).toBeGreaterThan(0);
		});

		it('should return an empty buffer for empty string', async () => {
			const compressed = await gzipBuffer(Buffer.alloc(0));

			expect(compressed).toBeInstanceOf(Buffer);
			expect(compressed.length).toBe(0);
		});

		it('should compress a large string', async () => {
			const largeString = 'abcdefghijklmnopqrstuvwxyz'.repeat(1000);
			const compressed = await gzipBuffer(Buffer.from(largeString));

			expect(compressed).toBeInstanceOf(Buffer);
			expect(compressed.length).toBeLessThan(largeString.length);
		});

		it('should handle strings with special characters', async () => {
			const specialString =
				"Special characters: !@#$%^&*()_+{}|:<>?~`-=[]\\;',./";
			const compressed = await gzipBuffer(Buffer.from(specialString));

			expect(compressed).toBeInstanceOf(Buffer);
			expect(compressed.length).toBeGreaterThan(0);
		});

		it('should handle Unicode strings', async () => {
			const unicodeString = 'Unicode: 你好, 世界! ñ Ö ß';
			const compressed = await gzipBuffer(Buffer.from(unicodeString));

			expect(compressed).toBeInstanceOf(Buffer);
			expect(compressed.length).toBeGreaterThan(0);
		});
	});

	describe('gunzipBuffer', () => {
		it('should decompress a compressed buffer', async () => {
			const testString = 'Hello, world!';
			const compressed = await gzipBuffer(Buffer.from(testString));
			const decompressed = await gunzipBuffer(compressed);

			expect(decompressed.toString('utf-8')).toBe(testString);
		});

		it('should return an empty string for empty buffer', async () => {
			const decompressed = await gunzipBuffer(Buffer.from([]));

			expect(decompressed.length).toBe(0);
		});

		it('should not throw an error for invalid gzip data', async () => {
			const invalidBuffer = Buffer.from('not gzipped data');

			await expect(gunzipBuffer(invalidBuffer)).resolves.toBe(invalidBuffer);
		});

		it('should handle null or undefined input', async () => {
			const decompressedNull = await gunzipBuffer(null as unknown as Buffer);
			const decompressedUndefined = await gunzipBuffer(
				undefined as unknown as Buffer
			);

			expect(decompressedNull.length).toBe(0);
			expect(decompressedUndefined.length).toBe(0);
		});
	});

	describe('Roundtrip Tests', () => {
		it('should correctly roundtrip a simple string', async () => {
			const testString = 'Hello, world!';
			const compressed = await gzipBuffer(Buffer.from(testString));
			const decompressed = await gunzipBuffer(compressed);

			expect(decompressed.toString('utf-8')).toBe(testString);
		});

		it('should correctly roundtrip a large string', async () => {
			const largeString = 'abcdefghijklmnopqrstuvwxyz'.repeat(1000);
			const compressed = await gzipBuffer(Buffer.from(largeString));
			const decompressed = await gunzipBuffer(compressed);

			expect(decompressed.toString('utf-8')).toBe(largeString);
		});

		it('should correctly roundtrip a JSON string', async () => {
			const jsonObject = {
				name: 'Test Object',
				properties: {
					number: 123,
					boolean: true,
					array: [1, 2, 3, 4, 5],
				},
			};
			const jsonString = JSON.stringify(jsonObject);

			const compressed = await gzipBuffer(Buffer.from(jsonString));
			const decompressed = await gunzipBuffer(compressed);

			expect(decompressed.toString('utf-8')).toBe(jsonString);
			expect(JSON.parse(decompressed.toString('utf-8'))).toEqual(jsonObject);
		});

		it('should correctly roundtrip Unicode strings', async () => {
			const unicodeString = 'Unicode: 你好, 世界! ñ Ö ß';
			const compressed = await gzipBuffer(Buffer.from(unicodeString));
			const decompressed = await gunzipBuffer(compressed);

			expect(decompressed.toString('utf-8')).toBe(unicodeString);
		});
	});
});
