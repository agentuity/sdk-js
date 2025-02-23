import type { AgentRequestHandler, Json, AgentRequestType } from "../types";

export default class AgentRequest implements AgentRequestHandler {
	private readonly request: AgentRequestType;

	constructor(request: AgentRequestType) {
		this.request = request;
	}

	get trigger(): string {
		return this.request.trigger;
	}

	private assertType(...type: string[]) {
		let contentType: string;
		if ("contentType" in this.request) {
			contentType = this.request.contentType;
			let matched = false;
			for (const t of type) {
				if (contentType === t) {
					matched = true;
					break;
				}
			}
			if (!matched) {
				throw new Error(`Expected content type ${type}, got ${contentType}`);
			}
			return;
		}
		throw new Error(
			`Expected content type ${type}, but no contentType provided`,
		);
	}

	metadata(key: string, defaultValue?: Json): Json {
		if (this.request.metadata) {
			return this.request.metadata[key] ?? defaultValue ?? null;
		}
		return defaultValue ?? null;
	}

	object<T>(): T {
		this.assertType("application/json");
		return this.request.payload as T;
	}

	json(): Json {
		this.assertType("application/json");
		return this.request.payload as Json;
	}

	text(): string {
		this.assertType("text/plain", "");
		return this.request.payload as string;
	}

	binary(): ArrayBuffer {
		this.assertType("application/octet-stream");
		return this.request.payload as ArrayBuffer;
	}

	pdf(): ArrayBuffer {
		this.assertType("application/pdf");
		return this.request.payload as ArrayBuffer;
	}

	png(): ArrayBuffer {
		this.assertType("image/png");
		return this.request.payload as ArrayBuffer;
	}

	jpeg(): ArrayBuffer {
		this.assertType("image/jpeg", "image/jpg");
		return this.request.payload as ArrayBuffer;
	}

	gif(): ArrayBuffer {
		this.assertType("image/gif");
		return this.request.payload as ArrayBuffer;
	}

	webp(): ArrayBuffer {
		this.assertType("image/webp");
		return this.request.payload as ArrayBuffer;
	}

	mp3(): ArrayBuffer {
		this.assertType("audio/mpeg", "audio/mp3");
		return this.request.payload as ArrayBuffer;
	}

	mp4(): ArrayBuffer {
		this.assertType("audio/mp4", "audio/mpeg4");
		return this.request.payload as ArrayBuffer;
	}

	m4a(): ArrayBuffer {
		this.assertType("audio/m4a");
		return this.request.payload as ArrayBuffer;
	}

	m4p(): ArrayBuffer {
		this.assertType("audio/m4p", "audio/mpeg4");
		return this.request.payload as ArrayBuffer;
	}

	webm(): ArrayBuffer {
		this.assertType("audio/webm");
		return this.request.payload as ArrayBuffer;
	}

	html(): string {
		this.assertType("text/html", "application/html");
		return this.request.payload as string;
	}

	wav(): ArrayBuffer {
		this.assertType("audio/wav");
		return this.request.payload as ArrayBuffer;
	}

	ogg(): ArrayBuffer {
		this.assertType("audio/ogg");
		return this.request.payload as ArrayBuffer;
	}
}
