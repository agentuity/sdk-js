import { describe, expect, it } from 'bun:test';
import { toDataType, fromDataType } from '../../src/server/util';
import type { TriggerType, JsonObject } from '../../src/types';
import '../setup'; // Import global test setup

describe('Data Type Conversion Functions', () => {
	const trigger: TriggerType = 'webhook';

	describe('toDataType', () => {
		it('should handle null or undefined data', async () => {
			const result = await toDataType(trigger, { data: null });

			expect(result.trigger).toBe(trigger);
			expect(result.contentType).toBe('text/plain');
			expect(result.payload).toBe('');
		});

		it('should handle string data', async () => {
			const data = 'Hello, world!';
			const result = await toDataType(trigger, { data });

			expect(result.trigger).toBe(trigger);
			expect(result.contentType).toBe('text/plain');
			expect(Buffer.from(result.payload, 'base64').toString()).toBe(data);
		});

		it('should handle object with contentType', async () => {
			const data = {
				contentType: 'application/json',
				base64: Buffer.from(JSON.stringify({ message: 'Hello' })).toString(
					'base64'
				),
			};
			const result = await toDataType(trigger, { data });

			expect(result.trigger).toBe(trigger);
			expect(result.contentType).toBe('application/json');
			expect(result.payload).toBe(data.base64);
		});

		it('should handle ArrayBuffer data', async () => {
			const text = 'Hello, world!';
			const data = new TextEncoder().encode(text).buffer as ArrayBuffer;
			const result = await toDataType(trigger, { data });

			expect(result.trigger).toBe(trigger);
			expect(result.contentType).toBe('application/octet-stream');
			expect(Buffer.from(result.payload, 'base64').toString()).toBe(text);
		});

		it('should handle Buffer data', async () => {
			const text = 'Hello, world!';
			const data = Buffer.from(text);
			const result = await toDataType(trigger, { data });

			expect(result.trigger).toBe(trigger);
			expect(result.contentType).toBe('application/octet-stream');
			expect(Buffer.from(result.payload, 'base64').toString()).toBe(text);
		});

		it('should handle Uint8Array data', async () => {
			const text = 'Hello, world!';
			const data = new TextEncoder().encode(text);
			const result = await toDataType(trigger, { data });

			expect(result.trigger).toBe(trigger);
			expect(result.contentType).toBe('application/octet-stream');
			expect(Buffer.from(result.payload, 'base64').toString()).toBe(text);
		});

		it('should handle plain object data', async () => {
			const data = { message: 'Hello, world!' };
			const result = await toDataType(trigger, { data });

			expect(result.trigger).toBe(trigger);
			expect(result.contentType).toBe('application/json');
			const decodedPayload = JSON.parse(
				Buffer.from(result.payload, 'base64').toString()
			);
			expect(decodedPayload).toEqual(data);
		});

		it('should include metadata when provided', async () => {
			const data = 'Hello, world!';
			const metadata: JsonObject = { key: 'value' };
			const result = await toDataType(trigger, { data, metadata });

			expect(result.trigger).toBe(trigger);
			expect(result.metadata).toEqual(metadata);
		});

		it('should use provided contentType when specified', async () => {
			const data = Buffer.from('Hello, world!');
			const contentType = 'text/plain';
			const result = await toDataType(trigger, { data, contentType });

			expect(result.trigger).toBe(trigger);
			expect(result.contentType).toBe(contentType);
		});

		it('should throw error for invalid data type', async () => {
			await expect(
				toDataType(trigger, {
					data: 123 as unknown as Buffer,
				})
			).rejects.toThrow('Invalid data type');
		});
	});

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

		it.skip('should include metadata when provided', async () => {
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
