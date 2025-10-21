import { describe, expect, it } from 'bun:test';
import { hash, hashSync } from '../../src/utils/hash';

describe('Hash Functions', () => {
	it('should produce the same hash for both async and sync functions', async () => {
		const testCases = [
			'Hello, World!',
			'',
			'This is a longer string with special characters: !@#$%^&*()',
			'Unicode test: 🚀 🌟 🎉',
			'Multiple\nlines\nwith\ttabs',
			'Very long string '.repeat(100),
		];

		for (const testString of testCases) {
			const asyncHash = await hash(testString);
			const syncHash = hashSync(testString);

			expect(asyncHash).toBe(syncHash);
			expect(asyncHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 produces 64 hex characters
			expect(syncHash).toMatch(/^[a-f0-9]{64}$/);
		}
	});

	it('should produce consistent hashes for the same input', async () => {
		const testString = 'Consistent hash test';

		const hash1 = await hash(testString);
		const hash2 = await hash(testString);
		const syncHash1 = hashSync(testString);
		const syncHash2 = hashSync(testString);

		expect(hash1).toBe(hash2);
		expect(syncHash1).toBe(syncHash2);
		expect(hash1).toBe(syncHash1);
	});

	it('should produce different hashes for different inputs', async () => {
		const string1 = 'Hello';
		const string2 = 'World';

		const hash1 = await hash(string1);
		const hash2 = await hash(string2);
		const syncHash1 = hashSync(string1);
		const syncHash2 = hashSync(string2);

		expect(hash1).not.toBe(hash2);
		expect(syncHash1).not.toBe(syncHash2);
		expect(hash1).toBe(syncHash1);
		expect(hash2).toBe(syncHash2);
	});

	it('should handle empty string', async () => {
		const emptyString = '';
		const asyncHash = await hash(emptyString);
		const syncHash = hashSync(emptyString);

		expect(asyncHash).toBe(syncHash);
		expect(asyncHash).toMatch(/^[a-f0-9]{64}$/);
	});
});
