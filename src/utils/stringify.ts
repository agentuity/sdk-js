/**
 * Safely stringify an object to JSON, handling circular references
 * @param obj - The object to stringify
 * @returns JSON string representation
 */
export function safeStringify(obj: unknown): string {
	const stack: unknown[] = [];

	function replacer(_key: string, value: unknown): unknown {
		if (typeof value === 'bigint') {
			return value.toString();
		}

		if (typeof value === 'object' && value !== null) {
			// Check if this object is already in our ancestor chain
			if (stack.includes(value)) {
				return '[Circular]';
			}

			// Add to stack before processing
			stack.push(value);

			// Process the object
			const result: Record<string, unknown> = Array.isArray(value) ? [] : {};

			for (const [k, v] of Object.entries(value)) {
				result[k] = replacer(k, v);
			}

			// Remove from stack after processing
			stack.pop();

			return result;
		}

		return value;
	}

	return JSON.stringify(replacer('', obj));
}
