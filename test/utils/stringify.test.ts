import { describe, expect, it } from 'bun:test';
import { safeStringify } from '../../src/utils/stringify';
import '../setup'; // Import global test setup

describe('safeStringify', () => {
	it('should stringify regular objects', () => {
		const obj = { name: 'test', value: 123 };
		const result = safeStringify(obj);
		expect(result).toBe('{"name":"test","value":123}');
	});

	it('should handle circular references', () => {
		const obj = { name: 'test' } as Record<string, unknown>;
		obj.self = obj;
		
		const result = safeStringify(obj);
		expect(result).toBe('{"name":"test","self":"[Circular]"}');
	});

	it('should handle bigint values', () => {
		const obj = { 
			regularNumber: 123,
			bigNumber: 9007199254740991n 
		};
		
		const result = safeStringify(obj);
		expect(result).toBe('{"regularNumber":123,"bigNumber":"9007199254740991"}');
	});

	it('should handle bigint in nested objects', () => {
		const obj = {
			data: {
				id: 1n,
				timestamp: BigInt(Date.now()),
				nested: {
					value: 42n
				}
			}
		};
		
		const result = safeStringify(obj);
		const parsed = JSON.parse(result);
		
		expect(typeof parsed.data.id).toBe('string');
		expect(parsed.data.id).toBe('1');
		expect(typeof parsed.data.timestamp).toBe('string');
		expect(typeof parsed.data.nested.value).toBe('string');
		expect(parsed.data.nested.value).toBe('42');
	});

	it('should handle bigint with circular references', () => {
		const obj = { 
			id: 123n,
			name: 'test' 
		} as Record<string, unknown>;
		obj.self = obj;
		
		const result = safeStringify(obj);
		expect(result).toBe('{"id":"123","name":"test","self":"[Circular]"}');
	});

	it('should handle arrays with bigint values', () => {
		const arr = [1n, 2n, { value: 3n }];
		
		const result = safeStringify(arr);
		expect(result).toBe('[\"1\",\"2\",{\"value\":\"3\"}]');
	});

	it('should handle edge case bigint values', () => {
		const obj = {
			zero: 0n,
			negative: -123n,
			maxSafe: BigInt(Number.MAX_SAFE_INTEGER),
			large: 123456789012345678901234567890n
		};
		
		const result = safeStringify(obj);
		const parsed = JSON.parse(result);
		
		expect(parsed.zero).toBe('0');
		expect(parsed.negative).toBe('-123');
		expect(parsed.maxSafe).toBe('9007199254740991');
		expect(parsed.large).toBe('123456789012345678901234567890');
	});
});
