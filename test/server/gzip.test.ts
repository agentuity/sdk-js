import { describe, expect, it } from 'bun:test';
import { gzipString, gunzipBuffer } from '../../src/server/gzip';
import '../setup'; // Import global test setup

describe('Compression Utilities', () => {
	describe('gzipString', () => {
		it('should compress a simple string', async () => {
			const testString = 'Hello, world!';
			const compressed = await gzipString(testString);

			expect(compressed).toBeInstanceOf(Buffer);
			expect(compressed.length).toBeGreaterThan(0);
		});

		it('should return an empty buffer for empty string', async () => {
			const compressed = await gzipString('');

			expect(compressed).toBeInstanceOf(Buffer);
			expect(compressed.length).toBe(0);
		});

		it('should handle null or undefined input', async () => {
			const compressedNull = await gzipString(null as unknown as string);
			const compressedUndefined = await gzipString(
				undefined as unknown as string
			);

			expect(compressedNull).toBeInstanceOf(Buffer);
			expect(compressedNull.length).toBe(0);
			expect(compressedUndefined).toBeInstanceOf(Buffer);
			expect(compressedUndefined.length).toBe(0);
		});

		it('should compress a large string', async () => {
			const largeString = 'abcdefghijklmnopqrstuvwxyz'.repeat(1000);
			const compressed = await gzipString(largeString);

			expect(compressed).toBeInstanceOf(Buffer);
			expect(compressed.length).toBeLessThan(largeString.length);
		});

		it('should handle strings with special characters', async () => {
			const specialString =
				"Special characters: !@#$%^&*()_+{}|:<>?~`-=[]\\;',./";
			const compressed = await gzipString(specialString);

			expect(compressed).toBeInstanceOf(Buffer);
			expect(compressed.length).toBeGreaterThan(0);
		});

		it('should handle Unicode strings', async () => {
			const unicodeString = 'Unicode: 你好, 世界! ñ Ö ß';
			const compressed = await gzipString(unicodeString);

			expect(compressed).toBeInstanceOf(Buffer);
			expect(compressed.length).toBeGreaterThan(0);
		});
	});

	describe('gunzipBuffer', () => {
		it('should decompress a compressed buffer', async () => {
			const testString = 'Hello, world!';
			const compressed = await gzipString(testString);
			const decompressed = await gunzipBuffer(compressed);

			expect(decompressed).toBe(testString);
		});

		it('should return an empty string for empty buffer', async () => {
			const decompressed = await gunzipBuffer(Buffer.from([]));

			expect(decompressed).toBe('');
		});

		it('should throw an error for invalid gzip data', async () => {
			const invalidBuffer = Buffer.from('not gzipped data');

			await expect(gunzipBuffer(invalidBuffer)).rejects.toThrow();
		});

		it('should handle null or undefined input', async () => {
			const decompressedNull = await gunzipBuffer(null as unknown as Buffer);
			const decompressedUndefined = await gunzipBuffer(
				undefined as unknown as Buffer
			);

			expect(decompressedNull).toBe('');
			expect(decompressedUndefined).toBe('');
		});
	});

	describe('Roundtrip Tests', () => {
		it('should correctly roundtrip a simple string', async () => {
			const testString = 'Hello, world!';
			const compressed = await gzipString(testString);
			const decompressed = await gunzipBuffer(compressed);

			expect(decompressed).toBe(testString);
		});

		it('should correctly roundtrip a large string', async () => {
			const largeString = 'abcdefghijklmnopqrstuvwxyz'.repeat(1000);
			const compressed = await gzipString(largeString);
			const decompressed = await gunzipBuffer(compressed);

			expect(decompressed).toBe(largeString);
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

			const compressed = await gzipString(jsonString);
			const decompressed = await gunzipBuffer(compressed);

			expect(decompressed).toBe(jsonString);
			expect(JSON.parse(decompressed)).toEqual(jsonObject);
		});

		it('should correctly roundtrip Unicode strings', async () => {
			const unicodeString = 'Unicode: 你好, 世界! ñ Ö ß';
			const compressed = await gzipString(unicodeString);
			const decompressed = await gunzipBuffer(compressed);

			expect(decompressed).toBe(unicodeString);
		});
	});
});
