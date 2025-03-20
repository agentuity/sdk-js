import { readFileSync, existsSync, createReadStream } from 'node:fs';
import { ReadableStream } from 'node:stream/web';
import path from 'node:path';
import type { Data, DataPayload, ReadableDataType } from '../types';
import { safeParse } from '../server/util';

const invalidJsonSymbol = Symbol('invalid json');

// regex to split the data into chunks
const chunkingRegexp: RegExp = /[^\n]*\n/m;

// milliseconds to wait between chunks to smooth out the stream
const chunkSmoothing = 30;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Arguments = Pick<DataPayload, 'contentType' | 'payload'>;

/**
 * The implementation of the Data interface
 */
export class DataHandler implements Data {
	private readonly payload: Arguments;
	private readonly type: string;
	private isStream = false;
	private streamLoaded = false;
	private readstream?:
		| ReadableStream<ReadableDataType>
		| AsyncIterable<ReadableDataType>;

	constructor(
		payload: Arguments,
		stream?: ReadableStream<ReadableDataType> | AsyncIterable<ReadableDataType>
	) {
		this.payload = payload;
		this.type = payload.contentType ?? 'application/octet-stream';
		this.isStream = this.payload?.payload?.startsWith('blob:') ?? false;
		this.readstream = stream;
	}

	private getStreamFilename() {
		// this function will ensure that the stream is loaded on-demand as needed, once.
		if (this.payload?.payload && this.isStream && !this.streamLoaded) {
			const id = this.payload.payload.substring('blob:'.length);
			const streamDir = process.env.AGENTUITY_IO_INPUT_DIR;
			if (!streamDir) {
				throw new Error('AGENTUITY_IO_INPUT_DIR is not set');
			}
			const fn = path.join(streamDir, id);
			if (!existsSync(fn)) {
				throw new Error(`Stream file ${fn} does not exist`);
			}
			return fn;
		}
	}

	private ensureStreamLoaded() {
		// this function will ensure that the stream is loaded on-demand as needed, once.
		const filename = this.getStreamFilename();
		if (filename) {
			const streamBuf = readFileSync(filename, 'utf-8');
			this.payload.payload = Buffer.from(streamBuf).toString('base64');
			this.streamLoaded = true;
		}
	}

	public toString() {
		this.ensureStreamLoaded();
		return this.base64;
	}

	public toJSON() {
		this.ensureStreamLoaded();
		return {
			contentType: this.contentType,
			base64: this.base64,
		};
	}

	private get data() {
		if (!this.payload.payload) {
			return Buffer.from([]);
		}
		this.ensureStreamLoaded();
		return Buffer.from(this.payload.payload, 'base64');
	}

	get contentType() {
		return this.type;
	}

	get base64() {
		this.ensureStreamLoaded();
		return this.payload.payload ?? '';
	}

	get text() {
		this.ensureStreamLoaded();
		return this.data.toString('utf-8');
	}

	get json() {
		const text = this.text;
		const res = safeParse(text, invalidJsonSymbol);
		if (res === invalidJsonSymbol) {
			throw new Error('The content type is not valid JSON');
		}
		return res;
	}

	object<T>(): T {
		const res = this.json;
		return res as T;
	}

	get binary() {
		const data = this.data;
		return new Uint8Array(data);
	}

	get blob() {
		const data = this.data;
		return new Blob([data], { type: this.contentType });
	}

	get arrayBuffer() {
		const data = this.data;
		return data.buffer;
	}

	get stream(): ReadableStream<ReadableDataType> {
		if (this.readstream) {
			if (this.readstream instanceof ReadableStream) {
				return this.readstream;
			}
			const iterator = this.readstream;
			return new ReadableStream({
				async start(controller) {
					for await (const chunk of iterator) {
						controller.enqueue(chunk);
					}
					controller.close();
				},
			});
		}
		const filename = this.getStreamFilename();
		if (filename) {
			const nodeStream = createReadStream(filename, 'utf-8');
			return new ReadableStream({
				start(controller) {
					nodeStream.on('data', (chunk) => {
						controller.enqueue(Buffer.from(chunk));
					});
					nodeStream.on('end', () => {
						controller.close();
					});
					nodeStream.on('error', (err) => {
						controller.error(err);
					});
				},
				cancel() {
					nodeStream.destroy();
				},
			});
		}
		const data = this.data;
		return new ReadableStream({
			async start(controller) {
				let match: RegExpExecArray | null;
				let buffer = data.toString('utf-8');
				match = chunkingRegexp.exec(buffer);
				while (match !== null) {
					const chunk = match[0];
					controller.enqueue(Buffer.from(chunk));
					buffer = buffer.slice(chunk.length);
					match = chunkingRegexp.exec(buffer);
					await sleep(chunkSmoothing);
				}
				controller.close();
			},
		});
	}

	get buffer() {
		return this.data;
	}
}
