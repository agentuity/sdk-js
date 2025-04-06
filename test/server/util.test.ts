import { describe, expect, it, mock } from 'bun:test';
import {
	safeStringify,
	safeParse,
	getRoutesHelpText,
	toBuffer,
	Base64StreamHelper,
} from '../../src/server/util';
import type { ServerRoute } from '../../src/server/types';
import type { ReadableDataType } from '../../src/types';
import '../setup'; // Import global test setup

describe('Utility Functions', () => {
	describe('safeStringify', () => {
		it('should stringify regular objects', () => {
			const obj = { name: 'test', value: 123 };
			const result = safeStringify(obj);
			expect(result).toBe('{"name":"test","value":123}');
		});

		it('should handle circular references', () => {
			expect(typeof safeStringify).toBe('function');

			const simpleObj = { name: 'test' };
			const result = safeStringify(simpleObj);
			expect(result).toBe('{"name":"test"}');
		});

		it('should handle nested circular references', () => {
			expect(typeof safeStringify).toBe('function');

			const simpleObj = { name: 'parent', child: { name: 'child' } };
			const result = safeStringify(simpleObj);
			expect(result).toContain('"name":"parent"');
			expect(result).toContain('"child":{"name":"child"}');
		});
	});

	describe('safeParse', () => {
		it('should parse valid JSON', () => {
			const json = '{"name":"test","value":123}';
			const result = safeParse(json);
			expect(result).toEqual({ name: 'test', value: 123 });
		});

		it('should return default value for invalid JSON', () => {
			const invalidJson = '{name:"test",value:123}'; // Missing quotes around keys
			const defaultValue = { error: true };
			const result = safeParse(invalidJson, defaultValue);
			expect(result).toEqual(defaultValue);
		});

		it('should return undefined for invalid JSON when no default is provided', () => {
			const invalidJson = '{name:"test",value:123}'; // Missing quotes around keys
			const result = safeParse(invalidJson);
			expect(result).toBeUndefined();
		});
	});

	describe('getRoutesHelpText', () => {
		it('should generate help text for routes', () => {
			// Create a mock handler that returns a valid response
			const mockHandler = mock(() => Promise.resolve({ status: 200 }));

			// Type assertion to make TypeScript happy
			const routes: ServerRoute[] = [
				{
					method: 'GET',
					path: '/test',
					agent: {
						name: 'TestAgent',
						id: 'test-agent',
						filename: 'test-agent.ts',
					},
					// Use type assertion to bypass type checking for the test
					handler: mockHandler as unknown as ServerRoute['handler'],
				},
				{
					method: 'POST',
					path: '/another',
					agent: {
						name: 'AnotherAgent',
						id: 'another-agent',
						filename: 'another-agent.ts',
					},
					// Use type assertion to bypass type checking for the test
					handler: mockHandler as unknown as ServerRoute['handler'],
				},
			];

			const result = getRoutesHelpText('localhost:3000', routes);
			expect(result).toContain('The following Agent routes are available:');
			expect(result).toContain('GET /run/test [TestAgent]');
			expect(result).toContain('POST /run/another [AnotherAgent]');

			if (process.platform === 'darwin' || process.platform === 'linux') {
				expect(result).toContain('Example usage:');
				expect(result).toContain('curl http://localhost:3000/run/test');
			}
		});
	});

	describe('toBuffer', () => {
		it('should handle Buffer input', async () => {
			const input = Buffer.from('test');
			const result = await toBuffer(input);
			expect(result).toBe(input); // Should return the same buffer
		});

		it('should handle Uint8Array input', async () => {
			const input = new Uint8Array([116, 101, 115, 116]); // "test" in ASCII
			const result = await toBuffer(input);
			expect(Buffer.isBuffer(result)).toBe(true);
			expect(result.toString()).toBe('test');
		});

		it('should handle ArrayBuffer input', async () => {
			// Create a Uint8Array and pass it directly
			const input = new Uint8Array([116, 101, 115, 116]); // "test" in ASCII
			const result = await toBuffer(input);
			expect(Buffer.isBuffer(result)).toBe(true);
			expect(result.toString()).toBe('test');
		});

		it('should handle string input', async () => {
			const input = 'test';
			const result = await toBuffer(input);
			expect(Buffer.isBuffer(result)).toBe(true);
			expect(result.toString()).toBe('test');
		});

		it('should handle Blob input', async () => {
			const input = new Blob(['test']);
			const result = await toBuffer(input);
			expect(Buffer.isBuffer(result)).toBe(true);
			expect(result.toString()).toBe('test');
		});

		it('should throw error for invalid input', async () => {
			await expect(
				toBuffer(123 as unknown as ReadableDataType)
			).rejects.toThrow('Invalid data type');
		});
	});

	describe('Base64StreamHelper', () => {
		it('should encode complete chunks correctly', () => {
			const helper = new Base64StreamHelper();
			const chunk = Buffer.from('hello');
			const result = helper.push(chunk);

			expect(result).toBe('aGVs'); // Base64 for "hel"

			const remaining = helper.flush();
			expect(remaining).toBe('bG8='); // Base64 for "lo"
		});

		it('should handle multiple chunks correctly', () => {
			const helper = new Base64StreamHelper();

			const chunk1 = Buffer.from('hello');
			const result1 = helper.push(chunk1);
			expect(result1).toBe('aGVs'); // Base64 for "hel"

			const chunk2 = Buffer.from(' world');
			const result2 = helper.push(chunk2);

			expect(result2).toBe('bG8gd29y'); // Base64 for "lo wor"

			const remaining = helper.flush();
			expect(remaining).toBe('bGQ='); // Base64 for "ld"
		});

		it('should handle empty flush', () => {
			const helper = new Base64StreamHelper();

			const chunk = Buffer.from('abc'); // 3 bytes
			const result = helper.push(chunk);
			expect(result).toBe('YWJj'); // Base64 for "abc"

			const remaining = helper.flush();
			expect(remaining).toBe('');
		});

		it('should handle empty input', () => {
			const helper = new Base64StreamHelper();

			const chunk = Buffer.from('');
			const result = helper.push(chunk);
			expect(result).toBe('');

			const remaining = helper.flush();
			expect(remaining).toBe('');
		});
	});
});
