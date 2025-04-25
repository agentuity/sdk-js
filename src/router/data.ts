import { ReadableStream } from 'node:stream/web';
import type { Data, ReadableDataType, Json } from '../types';
import { safeParse } from '../server/util';

const invalidJsonSymbol = Symbol('invalid json');

// regex to split the data into chunks
const chunkingRegexp: RegExp = /[^\n]*\n/m;

// milliseconds to wait between chunks to smooth out the stream
const chunkSmoothing = 30;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toBuffer = async (
	buffer: Buffer,
	value: ReadableDataType
): Promise<Buffer> => {
	if (value instanceof Uint8Array) {
		return Buffer.concat([buffer, value]);
	}
	if (value instanceof ArrayBuffer) {
		return Buffer.concat([buffer, Buffer.from(value)]);
	}
	if (value instanceof Blob) {
		const buf = await value.arrayBuffer();
		return Buffer.concat([buffer, Buffer.from(buf)]);
	}
	if (typeof value === 'string') {
		return Buffer.concat([buffer, Buffer.from(value)]);
	}
	throw new Error(`Unsupported value type: ${typeof value}`);
};

/**
 * The implementation of the Data interface
 */
export class DataHandler implements Data {
	private readonly _type: string;
	private _readstream?:
		| ReadableStream<ReadableDataType>
		| AsyncIterable<ReadableDataType>;
	private _buffer: Buffer;

	constructor(
		stream:
			| string
			| Buffer
			| ReadableStream<ReadableDataType>
			| AsyncIterable<ReadableDataType>,
		contentType: string
	) {
		this._type = contentType ?? 'application/octet-stream';
		if (typeof stream === 'string') {
			this._buffer = Buffer.from(stream);
		} else if (stream instanceof Buffer) {
			this._buffer = stream;
		} else {
			this._readstream = stream as unknown as
				| ReadableStream<ReadableDataType>
				| AsyncIterable<ReadableDataType>;
			this._buffer = Buffer.alloc(0);
		}
	}

	private async ensureStreamLoaded(): Promise<Buffer> {
		if (this._buffer.length === 0 && this._readstream) {
			let buffer: Buffer = Buffer.alloc(0);
			if (this._readstream instanceof ReadableStream) {
				const reader = this._readstream.getReader();
				while (true) {
					const { done, value } = await reader.read();
					if (value) {
						buffer = await toBuffer(buffer, value);
					}
					if (done) {
						break;
					}
				}
			} else {
				for await (const chunk of this._readstream) {
					buffer = await toBuffer(buffer, chunk);
				}
			}
			this._buffer = buffer;
			this._readstream = undefined;
		}
		return this._buffer;
	}

	public toString() {
		return `[Data ${this._type}]`;
	}

	private async data(): Promise<Buffer> {
		return this.ensureStreamLoaded();
	}

	get contentType(): string {
		return this._type;
	}

	async base64(): Promise<string> {
		const data = await this.data();
		return data.toString('base64');
	}

	async text(): Promise<string> {
		const data = await this.data();
		if (!data || data.length === 0) {
			return '';
		}
		return data.toString('utf-8');
	}

	async json(): Promise<Json> {
		const text = await this.text();
		if (!text || text.trim() === '') {
			throw new Error('Cannot parse empty JSON');
		}
		const res = safeParse(text, invalidJsonSymbol);
		if (res === invalidJsonSymbol) {
			throw new Error('The content type is not valid JSON');
		}
		return res as Json;
	}

	async object<T>(): Promise<T> {
		try {
			const res = await this.json();
			return res as T;
		} catch (error) {
			throw new Error(
				`Failed to parse object: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	async binary(): Promise<Uint8Array> {
		const data = await this.data();
		return new Uint8Array(data);
	}

	async blob(): Promise<Blob> {
		const data = await this.data();
		return new Blob([data], { type: this.contentType });
	}

	async arrayBuffer(): Promise<ArrayBuffer> {
		const data = await this.data();
		return data.buffer as ArrayBuffer;
	}

	async stream(): Promise<ReadableStream<ReadableDataType>> {
		if (this._readstream) {
			if (this._readstream instanceof ReadableStream) {
				return this._readstream;
			}
			const iterator = this._readstream;
			return new ReadableStream({
				async start(controller) {
					for await (const chunk of iterator) {
						controller.enqueue(chunk);
					}
					controller.close();
				},
			});
		}
		const dataPromise = this.data();
		const chunkable = this.isTextChunkable();
		return new ReadableStream({
			async start(controller) {
				const data = await dataPromise;
				if (!chunkable) {
					controller.enqueue(data);
					controller.close();
					return;
				}
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
				// in case we have a partial chunk remaining, we need to enqueue it
				if (buffer.length > 0) {
					controller.enqueue(Buffer.from(buffer));
				}
				controller.close();
			},
		});
	}

	private isTextChunkable() {
		return (
			this.contentType.startsWith('text/') ||
			this.contentType === 'application/json'
		);
	}

	async buffer(): Promise<Buffer> {
		return this.data();
	}
}
