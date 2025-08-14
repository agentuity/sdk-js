import { ReadableStream } from 'node:stream/web';
import { type DiscordMessage, parseDiscordMessage } from '../io/discord';
import { type Email, parseEmail } from '../io/email';
import { type Slack, parseSlack } from '../io/slack';
import { type Sms, parseSms } from '../io/sms';
import { type Teams, parseTeams } from '../io/teams';
import type { AgentuityTeamsActivityHandlerConstructor } from '../io/teams/AgentuityTeamsActivityHandler';
import { type Telegram, parseTelegram } from '../io/telegram';
import { safeParse } from '../server/util';
import type { Data, Json, JsonObject, ReadableDataType } from '../types';

const invalidJsonSymbol = Symbol('invalid json');

// regex to split the data into chunks
const chunkingRegexp = {
	word: /\S+\s+/m,
	line: /\n+/m,
};

// milliseconds to wait between chunks to smooth out the stream
const chunkSmoothing = 10;

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
	private readonly _metadata?: JsonObject;
	private _readstream?:
		| ReadableStream<ReadableDataType>
		| AsyncIterable<ReadableDataType>;
	private _buffer: Buffer;
	private _email?: Email;

	constructor(
		stream:
			| string
			| Buffer
			| ReadableStream<ReadableDataType>
			| AsyncIterable<ReadableDataType>,
		contentType: string,
		metadata?: JsonObject
	) {
		this._type = contentType ?? 'application/octet-stream';
		this._metadata = metadata;
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
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (value) {
							buffer = await toBuffer(buffer, value);
						}
						if (done) {
							break;
						}
					}
				} catch (err) {
					// propagate cancellation to the underlying source
					if (reader && typeof reader.cancel === 'function') {
						try {
							await reader.cancel(err);
						} catch (ex) {
							// ignore
						}
					}
					throw err;
				} finally {
					if (reader && typeof reader.releaseLock === 'function') {
						try {
							reader.releaseLock();
						} catch (ex) {
							// ignore
						}
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
		const contentType = this.contentType;
		return new ReadableStream({
			async start(controller) {
				const data = await dataPromise;
				if (!chunkable) {
					controller.enqueue(data);
					controller.close();
					return;
				}
				const chunkby = contentType.startsWith('text/') ? 'word' : 'line';
				const re = chunkingRegexp[chunkby];
				let match: RegExpExecArray | null;
				let buffer = data.toString('utf-8');
				match = re.exec(buffer);
				while (match !== null) {
					const chunk = match[0];
					controller.enqueue(Buffer.from(chunk));
					buffer = buffer.slice(chunk.length);
					match = re.exec(buffer);
					if (!match) {
						break;
					}
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

	async email(): Promise<Email> {
		if (this.contentType !== 'message/rfc822') {
			throw new Error('The content type is not a valid email');
		}
		if (this._email) {
			return this._email;
		}
		const data = await this.data();
		this._email = await parseEmail(data);
		return this._email;
	}

	async sms(): Promise<Sms> {
		if (this.contentType !== 'application/json') {
			throw new Error('The content type is not a valid sms');
		}
		const data = await this.data();
		return parseSms(data);
	}

	async discord(): Promise<DiscordMessage> {
		if (this.contentType !== 'application/json') {
			throw new Error('The content type is not a valid discord message');
		}
		const data = await this.data();
		return parseDiscordMessage(data);
	}

	async telegram(): Promise<Telegram> {
		if (this.contentType !== 'application/json') {
			throw new Error('The content type is not a valid telegram message');
		}
		const data = await this.data();
		return parseTelegram(data);
	}

	async slack(): Promise<Slack> {
		if (this.contentType !== 'application/json') {
			throw new Error('The content type is not a valid slack message');
		}
		const data = await this.data();

		// Get message type from metadata, default to 'slack-event'
		const messageType = this._metadata?.['msg-type'] as
			| 'slack-event'
			| 'slack-message'
			| undefined;
		const slackMessageType: 'slack-event' | 'slack-message' =
			messageType === 'slack-message' ? 'slack-message' : 'slack-event';

		return parseSlack(data, slackMessageType);
	}

	async teams(
		botClass: AgentuityTeamsActivityHandlerConstructor
	): Promise<Teams> {
		const data = await this.data();
		return parseTeams(data, botClass);
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
