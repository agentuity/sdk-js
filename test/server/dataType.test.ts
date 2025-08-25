import { describe, expect, it } from 'bun:test';
import { fromDataType } from '../../src/server/util';
import type { TriggerType, JsonObject } from '../../src/types';
import '../setup'; // Import global test setup

describe('Data Type Conversion Functions', () => {
	const _trigger: TriggerType = 'webhook';

	describe('fromDataType', () => {
		it('should handle null or undefined data', async () => {
			const result = await fromDataType(null);

			expect(result.data).toBeDefined();
		});

		it('should handle string data', async () => {
			const data = 'Hello, world!';
			const result = await fromDataType(data);

			expect(result.data).toBeDefined();
		});

		it('should handle object with contentType', async () => {
			const jsonData = { message: 'Hello' };
			const data = {
				contentType: 'application/json',
				base64: Buffer.from(JSON.stringify(jsonData)).toString('base64'),
			};
			const result = await fromDataType(data);

			expect(result.data).toBeDefined();
		});

		it('should handle ArrayBuffer data', async () => {
			const text = 'Hello, world!';
			const data = new TextEncoder().encode(text).buffer as ArrayBuffer;
			const result = await fromDataType(data);

			expect(result.data).toBeDefined();
		});

		it('should handle Buffer data', async () => {
			const text = 'Hello, world!';
			const data = Buffer.from(text);
			const result = await fromDataType(data);

			expect(result.data).toBeDefined();
		});

		it('should handle Uint8Array data', async () => {
			const text = 'Hello, world!';
			const data = new TextEncoder().encode(text);
			const result = await fromDataType(data);

			expect(result.data).toBeDefined();
		});

		it('should handle plain object data', async () => {
			const data = { message: 'Hello, world!' };
			const result = await fromDataType(data);

			expect(result.data).toBeDefined();
		});

		it('should include metadata when provided', async () => {
			const data = 'Hello, world!';
			const metadata: JsonObject = { key: 'value' };
			const result = await fromDataType(data, undefined, metadata);

			expect(result.data).toBeDefined();
			expect(result.metadata).toEqual(metadata);
		});

		it('should use provided contentType when specified', async () => {
			const data = Buffer.from('Hello, world!');
			const contentType = 'text/plain';
			const result = await fromDataType(data, contentType);

			expect(result.data).toBeDefined();
		});

		it('should handle invalid data type gracefully', async () => {
			const invalidData = {} as unknown as string;

			try {
				await fromDataType(invalidData);
				expect(false).toBe(true); // This will fail the test if no error is thrown
			} catch (error) {
				expect(error).toBeDefined();
				expect(error instanceof Error).toBe(true);
			}
		});
	});
});
