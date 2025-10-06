import { describe, expect, it } from 'bun:test';
import {
	extractVariables,
	interpolateTemplate,
} from '../../src/utils/interpolate';

describe('interpolateTemplate', () => {
	interface TestCase {
		input: string;
		variables?: Record<string, unknown>;
		expectedVal: string;
		expectedErr?: string;
	}

	const testCases: TestCase[] = [
		{ input: 'abc', variables: undefined, expectedVal: 'abc' },
		{ input: '', variables: undefined, expectedVal: '' },
		{
			input: 'this is a {test}',
			variables: { test: 'TEST' },
			expectedVal: 'this is a TEST',
		},
		{
			input: 'this is a {test} {notfound}',
			variables: { test: 'TEST' },
			expectedVal: 'this is a TEST ',
		},
		{
			input: 'this is a {test:-notfound}',
			variables: { foo: 'TEST' },
			expectedVal: 'this is a -notfound',
		},
		{
			input: 'this is a {test:-fail}',
			variables: { test: 'TEST' },
			expectedVal: 'this is a TEST',
		},
		{
			input: 'this is a {test}',
			variables: { test: 123 },
			expectedVal: 'this is a 123',
		},
		{
			input: 'this is a {test}',
			variables: { test: null },
			expectedVal: 'this is a ',
		},
		{
			input: 'this is a {test}',
			variables: { test: '' },
			expectedVal: 'this is a ',
		},
		{
			input: 'this is a {!test}',
			variables: { test: '' },
			expectedVal: '',
			expectedErr: "Required variable 'test' not provided",
		},
		{
			input: 'this is a {!test}',
			variables: { test: null },
			expectedVal: '',
			expectedErr: "Required variable 'test' not provided",
		},
		{
			input: 'this is a ${test}',
			variables: { test: null },
			expectedVal: 'this is a $',
		},
		{
			input: 'this is a ${test:-foo}',
			variables: { test: 'foo' },
			expectedVal: 'this is a $foo',
		},
		{
			input: 'this is a {{test}}',
			variables: { test: 'foo' },
			expectedVal: 'this is a foo',
		},
		{
			input: 'this is a {{test2:-foo}}',
			variables: { test: 'foo' },
			expectedVal: 'this is a -foo',
		},
	];

	for (const tc of testCases) {
		it(`should handle "${tc.input}" with variables ${JSON.stringify(tc.variables)}`, () => {
			if (tc.expectedErr) {
				expect(() => interpolateTemplate(tc.input, tc.variables)).toThrow(
					tc.expectedErr
				);
			} else {
				const result = interpolateTemplate(tc.input, tc.variables);
				expect(result).toBe(tc.expectedVal);
			}
		});
	}
});

describe('extractVariables', () => {
	interface TestCase {
		input: string;
		expected: string[];
	}

	const testCases: TestCase[] = [
		{ input: 'abc', expected: [] },
		{ input: '', expected: [] },
		{ input: 'this is a {test}', expected: ['test'] },
		{ input: 'this is a {test} {notfound}', expected: ['test', 'notfound'] },
		{ input: 'this is a {test:-notfound}', expected: ['test'] },
		{ input: 'this is a {!test}', expected: ['test'] },
		{ input: 'this is a {!test:-default}', expected: ['test'] },
		{ input: 'this is a {{test}}', expected: ['test'] },
		{ input: 'this is a {{test2:-foo}}', expected: ['test2'] },
		{
			input: 'multiple {var1} and {var2} and {var1} again',
			expected: ['var1', 'var2'],
		},
	];

	for (const tc of testCases) {
		it(`should extract variables from "${tc.input}"`, () => {
			const result = extractVariables(tc.input);
			expect(result).toEqual(tc.expected);
		});
	}
});
