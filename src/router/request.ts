import type { AgentRequest, Json, AgentRequestType } from '../types';

export default class AgentRequestHandler implements AgentRequest {
	private readonly request: AgentRequestType;

	constructor(request: AgentRequestType) {
		this.request = request;
	}

	get trigger(): string {
		return this.request.trigger;
	}

	private assertType(...type: string[]) {
		let contentType: string;
		if ('contentType' in this.request) {
			contentType = this.request.contentType;
			let matched = false;
			for (const t of type) {
				if (contentType === t) {
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
			return Buffer.from(this.request.payload as string, 'base64').buffer;
		}
		return new ArrayBuffer();
	}

	metadata(key: string, defaultValue?: Json): Json {
		if (this.request.metadata) {
			return this.request.metadata[key] ?? defaultValue ?? null;
		}
		return defaultValue ?? null;
	}

	object<T>(): T {
		this.assertType('application/json');
		return this.toJSON() as T;
	}

	json(): Json {
		this.assertType('application/json');
		return this.toJSON() as Json;
	}

	text(): string {
		this.assertType('text/plain', '');
		return this.toText();
	}

	binary(): ArrayBuffer {
		this.assertType('application/octet-stream');
		return this.toBinary();
	}

	pdf(): ArrayBuffer {
		this.assertType('application/pdf');
		return this.toBinary();
	}

	png(): ArrayBuffer {
		this.assertType('image/png');
		return this.toBinary();
	}

	jpeg(): ArrayBuffer {
		this.assertType('image/jpeg', 'image/jpg');
		return this.toBinary();
	}

	gif(): ArrayBuffer {
		this.assertType('image/gif');
		return this.toBinary();
	}

	webp(): ArrayBuffer {
		this.assertType('image/webp');
		return this.toBinary();
	}

	mp3(): ArrayBuffer {
		this.assertType('audio/mpeg', 'audio/mp3');
		return this.toBinary();
	}

	mp4(): ArrayBuffer {
		this.assertType('audio/mp4', 'audio/mpeg4');
		return this.toBinary();
	}

	m4a(): ArrayBuffer {
		this.assertType('audio/m4a');
		return this.toBinary();
	}

	m4p(): ArrayBuffer {
		this.assertType('audio/m4p', 'audio/mpeg4');
		return this.toBinary();
	}

	webm(): ArrayBuffer {
		this.assertType('audio/webm');
		return this.toBinary();
	}

	html(): string {
		this.assertType('text/html', 'application/html');
		return this.toText();
	}

	wav(): ArrayBuffer {
		this.assertType('audio/wav');
		return this.toBinary();
	}

	ogg(): ArrayBuffer {
		this.assertType('audio/ogg');
		return this.toBinary();
	}
}
