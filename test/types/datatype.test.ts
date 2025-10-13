import { describe, expect, it } from 'bun:test';
import { isDataType, isJsonObject, type DataType } from '../../src/types';
import { ReadableStream } from 'node:stream/web';
import '../setup';

describe('DataType validation', () => {
	describe('isDataType', () => {
		it('should accept string values', () => {
			expect(isDataType('hello')).toBe(true);
			expect(isDataType('')).toBe(true);
		});

		it('should accept Buffer', () => {
			expect(isDataType(Buffer.from('test'))).toBe(true);
		});

		it('should accept Uint8Array', () => {
			expect(isDataType(new Uint8Array([1, 2, 3]))).toBe(true);
		});

		it('should accept ArrayBuffer', () => {
			expect(isDataType(new ArrayBuffer(10))).toBe(true);
		});

		it('should accept Blob', () => {
			expect(isDataType(new Blob(['test']))).toBe(true);
		});

		it('should accept ReadableStream', () => {
			const stream = new ReadableStream();
			expect(isDataType(stream)).toBe(true);
		});

		it('should reject null and undefined', () => {
			expect(isDataType(null)).toBe(false);
			expect(isDataType(undefined)).toBe(false);
		});
	});

	describe('JsonPrimitive custom object support', () => {
		it('should accept generic custom objects with string keys', () => {
			const customObj: DataType = {
				name: 'John',
				age: 30,
				active: true,
				tags: ['user', 'admin'],
			};
			expect(isJsonObject(customObj)).toBe(true);
			expect(isDataType(customObj)).toBe(true);
		});

		it('should accept nested custom objects', () => {
			const nestedObj: DataType = {
				user: {
					name: 'Jane',
					profile: {
						bio: 'Developer',
						score: 100,
					},
				},
				settings: {
					notifications: true,
					theme: 'dark',
				},
			};
			expect(isJsonObject(nestedObj)).toBe(true);
			expect(isDataType(nestedObj)).toBe(true);
		});

		it('should accept objects with number keys as strings', () => {
			const obj: DataType = {
				'0': 'first',
				'1': 'second',
				'2': 'third',
			};
			expect(isJsonObject(obj)).toBe(true);
			expect(isDataType(obj)).toBe(true);
		});

		it('should accept objects with mixed primitive values', () => {
			const mixedObj: DataType = {
				string: 'text',
				number: 42,
				boolean: true,
				nullValue: null,
				array: [1, 2, 3],
				nested: {
					key: 'value',
				},
			};
			expect(isJsonObject(mixedObj)).toBe(true);
			expect(isDataType(mixedObj)).toBe(true);
		});

		it('should accept arrays of custom objects', () => {
			const arrayOfObjects: DataType = [
				{ id: 1, name: 'First' },
				{ id: 2, name: 'Second' },
				{ id: 3, name: 'Third', nested: { value: true } },
			];
			expect(isJsonObject(arrayOfObjects)).toBe(true);
			expect(isDataType(arrayOfObjects)).toBe(true);
		});

		it('should accept complex data structures', () => {
			const complexData: DataType = {
				metadata: {
					version: '1.0',
					timestamp: 1234567890,
				},
				items: [
					{
						id: '123',
						properties: {
							enabled: true,
							tags: ['a', 'b', 'c'],
						},
					},
				],
				config: {
					settings: {
						nested: {
							deeply: {
								value: 'deep',
							},
						},
					},
				},
			};
			expect(isJsonObject(complexData)).toBe(true);
			expect(isDataType(complexData)).toBe(true);
		});

		it('should handle empty objects and arrays', () => {
			expect(isJsonObject({})).toBe(true);
			expect(isDataType({})).toBe(true);
			expect(isJsonObject([])).toBe(true);
			expect(isDataType([])).toBe(true);
		});

		it('should accept objects with all JSON primitive types', () => {
			const allPrimitives: DataType = {
				str: 'string',
				num: 123,
				bool: true,
				nil: null,
				arr: [1, 'two', true, null],
				obj: { nested: 'value' },
			};
			expect(isJsonObject(allPrimitives)).toBe(true);
			expect(isDataType(allPrimitives)).toBe(true);
		});
	});

	describe('Data object with contentType', () => {
		it('should accept Data objects with contentType property', () => {
			const dataObj = {
				contentType: 'application/json',
				base64: async () => 'data',
			};
			expect(isDataType(dataObj)).toBe(true);
		});
	});

	describe('specific object shapes', () => {
		it('should accept {foo: 123}', () => {
			const obj: DataType = { foo: 123 };
			expect(isJsonObject(obj)).toBe(true);
			expect(isDataType(obj)).toBe(true);
		});

		it('should accept {foo: {bar: 123}}', () => {
			const obj: DataType = { foo: { bar: 123 } };
			expect(isJsonObject(obj)).toBe(true);
			expect(isDataType(obj)).toBe(true);
		});

		it('should accept {foo: true}', () => {
			const obj: DataType = { foo: true };
			expect(isJsonObject(obj)).toBe(true);
			expect(isDataType(obj)).toBe(true);
		});
	});

	describe('edge cases', () => {
		it('should handle primitives correctly', () => {
			expect(isJsonObject('string')).toBe(true);
			expect(isJsonObject(123)).toBe(true);
			expect(isJsonObject(true)).toBe(true);
			expect(isJsonObject(false)).toBe(true);
		});

		it('should handle deeply nested arrays', () => {
			const deepArray: DataType = [
				[
					[
						[1, 2, 3],
						[4, 5, 6],
					],
				],
			];
			expect(isJsonObject(deepArray)).toBe(true);
			expect(isDataType(deepArray)).toBe(true);
		});
	});
});
