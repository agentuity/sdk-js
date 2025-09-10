import { promisify } from 'node:util';
import { gunzip, gzip } from 'node:zlib';

// Promisify the zlib functions
const gzipPromise = promisify(gzip);
const gunzipPromise = promisify(gunzip);

/**
 * Compresses a Buffer using gzip and returns the gzipped version of the Buffer
 *
 * @param buffer - The Buffer data to compress
 * @returns A Promise that resolves to a Buffer containing the compressed data
 */
export async function gzipBuffer(buffer: Buffer): Promise<Buffer> {
	if (buffer.length === 0) {
		return buffer;
	}
	return gzipPromise(buffer);
}

/**
 * Decompresses a gzipped Buffer and returns the uncompressed Buffer
 *
 * @param buffer - The compressed Buffer to decompress
 * @returns A Promise that resolves to an uncompressed Buffer
 * @throws Error if the buffer is not valid gzipped data
 */
export async function gunzipBuffer(buffer: Buffer): Promise<Buffer> {
	if (!buffer || buffer.length === 0) {
		return Buffer.alloc(0);
	}
	// check to make sure it has the zlib header before trying to decompress
	// GZIP magic numbers: 0x1f 0x8b
	if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
		return gunzipPromise(buffer);
	}
	return buffer;
}
