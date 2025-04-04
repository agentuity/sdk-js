import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'node:util';

// Promisify the zlib functions
const gzipPromise = promisify(gzip);
const gunzipPromise = promisify(gunzip);

/**
 * Compresses a string using gzip and returns a Buffer
 *
 * @param data - The string data to compress
 * @returns A Promise that resolves to a Buffer containing the compressed data
 */
export async function gzipString(data: string): Promise<Buffer> {
	if (!data) {
		return Buffer.from([]);
	}

	// Convert string to Buffer and compress
	const buffer = Buffer.from(data, 'utf-8');
	return gzipPromise(buffer);
}

/**
 * Decompresses a gzipped Buffer and returns the original string
 *
 * @param buffer - The compressed Buffer to decompress
 * @returns A Promise that resolves to the original string
 * @throws Error if the buffer is not valid gzipped data
 */
export async function gunzipBuffer(buffer: Buffer): Promise<string> {
	if (!buffer || buffer.length === 0) {
		return '';
	}

	// Decompress buffer and convert to string
	const decompressed = await gunzipPromise(buffer);
	return decompressed.toString('utf-8');
}
