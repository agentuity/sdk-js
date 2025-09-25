/**
 * Safely stringify an object to JSON, handling circular references
 * @param obj - The object to stringify
 * @returns JSON string representation
 */
export function safeStringify(obj: unknown): string {
	const seen = new WeakSet();
	return JSON.stringify(obj, (_key, value) => {
		if (typeof value === 'bigint') {
			return value.toString();
		}
		if (typeof value === 'object' && value !== null) {
			if (seen.has(value)) {
				return '[Circular]';
			}
			seen.add(value);
		}
		return value;
	});
}
