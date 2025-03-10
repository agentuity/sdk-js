import type { Data, DataPayload } from '../types';
import { safeParse } from '../server/util';

const invalidJsonSymbol = Symbol('invalid json');

type Arguments = Pick<DataPayload, 'contentType' | 'payload'>;

/**
 * The implementation of the Data interface
 */
export class DataHandler implements Data {
	private readonly payload: Arguments;
	private readonly type: string;

	constructor(payload: Arguments) {
		this.payload = payload;
		this.type = payload.contentType ?? 'application/octet-stream';
	}

	public toString() {
		return this.base64;
	}

	public toJSON() {
		return {
			contentType: this.contentType,
			base64: this.base64,
		};
	}

	private get data() {
		if (!this.payload.payload) {
			return Buffer.from([]);
		}
		return Buffer.from(this.payload.payload, 'base64');
	}

	get contentType() {
		return this.type;
	}

	get base64() {
		return this.payload.payload ?? '';
	}

	get text() {
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

	get stream() {
		const data = this.data;
		return new ReadableStream({
			start(controller) {
				controller.enqueue(data);
				controller.close();
			},
		});
	}

	get buffer() {
		return this.data;
	}
}
