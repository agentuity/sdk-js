import type { AgentRequest, Json, AgentRequestType } from '../types';

/**
 * Handles agent requests and provides methods to access request data in various formats
 */
export default class AgentRequestHandler implements AgentRequest {
	private readonly request: AgentRequestType;

	/**
	 * Creates a new agent request handler
	 *
	 * @param request - The agent request to handle
	 */
	constructor(request: AgentRequestType) {
		this.request = request;
	}

	/**
	 * Gets the trigger for this request
	 *
	 * @returns The trigger string
	 */
	get trigger(): string {
		return this.request.trigger;
	}

	private assertType(...type: string[]) {
		let contentType: string;
		if ('contentType' in this.request) {
			contentType = this.request.contentType;
			let matched = false;
			for (const t of type) {
				if (contentType === t || t === '' || t === '*/*') {
					matched = true;
					break;
				}
			}
			if (!matched) {
				if (type.length === 1) {
					throw new Error(
						`Expected content type ${type[0]}, received ${contentType}`
					);
				}
				throw new Error(
					`Expected content type to be one of:${type.join(', ')}, received ${contentType}`
				);
			}
			return; // return when matched
		}
		for (const t of type) {
			if (t === '' || t === '*/*') {
				return; // return when matched even when no contentType property was provided in the request payload
			}
		}
		throw new Error(
			`Expected content type ${type}, but no contentType property was provided in the request payload`
		);
	}

	private toJSON() {
		if (this.request.payload) {
			return JSON.parse(
				Buffer.from(this.request.payload as string, 'base64').toString('utf-8')
			);
		}
		return null;
	}

	private toText() {
		if (this.request.payload) {
			return Buffer.from(this.request.payload as string, 'base64').toString(
				'utf-8'
			);
		}
		return '';
	}

	private toBinary(): ArrayBuffer {
		if (this.request.payload) {
			return Buffer.from(this.request.payload as string, 'base64')
				.buffer as ArrayBuffer;
		}
		return new ArrayBuffer(0);
	}

	/**
	 * Gets metadata from the request
	 *
	 * @param key - The metadata key to retrieve
	 * @param defaultValue - Value to return if the key is not found
	 * @returns The metadata value or defaultValue if not found
	 */
	metadata(key: string, defaultValue?: Json): Json {
		if (this.request.metadata) {
			return this.request.metadata[key] ?? defaultValue ?? null;
		}
		return defaultValue ?? null;
	}

	/**
	 * Gets the request payload as a typed object
	 *
	 * @returns The request payload as type T
	 * @throws Error if the content type is not application/json
	 */
	object<T>(): T {
		this.assertType('application/json');
		return this.toJSON() as T;
	}

	/**
	 * Gets the request payload as JSON
	 *
	 * @returns The request payload as JSON
	 * @throws Error if the content type is not application/json
	 */
	json(): Json {
		this.assertType('application/json');
		return this.toJSON() as Json;
	}

	/**
	 * Gets the request payload as text
	 *
	 * @returns The request payload as a string
	 * @throws Error if the content type is not text/plain
	 */
	text(): string {
		this.assertType('text/plain', '');
		return this.toText();
	}

	/**
	 * Gets the request payload as binary data
	 *
	 * @returns The request payload as an ArrayBuffer
	 * @throws Error if the content type is not application/octet-stream
	 */
	binary(): ArrayBuffer {
		this.assertType('application/octet-stream');
		return this.toBinary();
	}

	/**
	 * Gets the request payload as PDF data
	 *
	 * @returns The request payload as an ArrayBuffer
	 * @throws Error if the content type is not application/pdf
	 */
	pdf(): ArrayBuffer {
		this.assertType('application/pdf');
		return this.toBinary();
	}

	/**
	 * Gets the request payload as PNG image data
	 *
	 * @returns The request payload as an ArrayBuffer
	 * @throws Error if the content type is not image/png
	 */
	png(): ArrayBuffer {
		this.assertType('image/png');
		return this.toBinary();
	}

	/**
	 * Gets the request payload as JPEG image data
	 *
	 * @returns The request payload as an ArrayBuffer
	 * @throws Error if the content type is not image/jpeg or image/jpg
	 */
	jpeg(): ArrayBuffer {
		this.assertType('image/jpeg', 'image/jpg');
		return this.toBinary();
	}

	/**
	 * Gets the request payload as GIF image data
	 *
	 * @returns The request payload as an ArrayBuffer
	 * @throws Error if the content type is not image/gif
	 */
	gif(): ArrayBuffer {
		this.assertType('image/gif');
		return this.toBinary();
	}

	/**
	 * Gets the request payload as WebP image data
	 *
	 * @returns The request payload as an ArrayBuffer
	 * @throws Error if the content type is not image/webp
	 */
	webp(): ArrayBuffer {
		this.assertType('image/webp');
		return this.toBinary();
	}

	/**
	 * Gets the request payload as MP3 audio data
	 *
	 * @returns The request payload as an ArrayBuffer
	 * @throws Error if the content type is not audio/mpeg or audio/mp3
	 */
	mp3(): ArrayBuffer {
		this.assertType('audio/mpeg', 'audio/mp3');
		return this.toBinary();
	}

	/**
	 * Gets the request payload as MP4 audio data
	 *
	 * @returns The request payload as an ArrayBuffer
	 * @throws Error if the content type is not audio/mp4 or audio/mpeg4
	 */
	mp4(): ArrayBuffer {
		this.assertType('audio/mp4', 'audio/mpeg4');
		return this.toBinary();
	}

	/**
	 * Gets the request payload as M4A audio data
	 *
	 * @returns The request payload as an ArrayBuffer
	 * @throws Error if the content type is not audio/m4a
	 */
	m4a(): ArrayBuffer {
		this.assertType('audio/m4a');
		return this.toBinary();
	}

	/**
	 * Gets the request payload as M4P audio data
	 *
	 * @returns The request payload as an ArrayBuffer
	 * @throws Error if the content type is not audio/m4p or audio/mpeg4
	 */
	m4p(): ArrayBuffer {
		this.assertType('audio/m4p', 'audio/mpeg4');
		return this.toBinary();
	}

	/**
	 * Gets the request payload as WebM audio data
	 *
	 * @returns The request payload as an ArrayBuffer
	 * @throws Error if the content type is not audio/webm
	 */
	webm(): ArrayBuffer {
		this.assertType('audio/webm');
		return this.toBinary();
	}

	/**
	 * Gets the request payload as HTML
	 *
	 * @returns The request payload as a string
	 * @throws Error if the content type is not text/html or application/html
	 */
	html(): string {
		this.assertType('text/html', 'application/html');
		return this.toText();
	}

	/**
	 * Gets the request payload as WAV audio data
	 *
	 * @returns The request payload as an ArrayBuffer
	 * @throws Error if the content type is not audio/wav
	 */
	wav(): ArrayBuffer {
		this.assertType('audio/wav');
		return this.toBinary();
	}

	/**
	 * Gets the request payload as OGG audio data
	 *
	 * @returns The request payload as an ArrayBuffer
	 * @throws Error if the content type is not audio/ogg
	 */
	ogg(): ArrayBuffer {
		this.assertType('audio/ogg');
		return this.toBinary();
	}
}
