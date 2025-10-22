import crypto from 'crypto';

/**
 * Convert an ArrayBuffer to a hexadecimal string
 */
function arrayBufferToHex(arrayBuffer: ArrayBuffer): string {
	const array = Array.from(new Uint8Array(arrayBuffer));
	const hex = array.map((byte) => byte.toString(16).padStart(2, '0')).join('');
	return hex;
}

/**
 * Hash a string using SHA-256 and return the hexadecimal representation (async)
 */
export async function hash(value: string): Promise<string> {
	const ctBuffer = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(value)
	);
	return arrayBufferToHex(ctBuffer);
}

/**
 * Hash a string using SHA-256 and return the hexadecimal representation (sync)
 * Uses Node.js crypto for synchronous operation
 */
export function hashSync(value: string): string {
	return crypto.createHash('sha256').update(value).digest('hex');
}
