import type { AgentResponseHandler, AgentResponseType, Json } from "../types";

/**
 * The AgentResponse class implements the AgentResponseHandler interface.
 * It is used to create and return responses from an agent.
 */
export default class AgentResponse implements AgentResponseHandler {
	/**
	 * return an empty response with optional metadata
	 */
	empty(metadata?: Record<string, Json>): AgentResponseType {
		return {
			metadata,
		};
	}

	/**
	 * return a JSON response with optional metadata
	 */
	json(data: Json, metadata?: Record<string, Json>): AgentResponseType {
		return {
			contentType: "application/json",
			payload: data,
			metadata,
		};
	}

	/**
	 * return a text response with optional metadata
	 */
	text(data: string, metadata?: Record<string, Json>): AgentResponseType {
		return {
			contentType: "text/plain",
			payload: data,
			metadata,
		};
	}

	/**
	 * return a binary response with optional metadata
	 */
	binary(
		data: ArrayBuffer,
		metadata?: Record<string, Json>,
	): AgentResponseType {
		return {
			contentType: "application/octet-stream",
			payload: data,
			metadata,
		};
	}

	/**
	 * return a PDF response with optional metadata
	 */
	pdf(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType {
		return {
			contentType: "application/pdf",
			payload: data,
			metadata,
		};
	}

	/**
	 * return a PNG response with optional metadata
	 */
	png(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType {
		return {
			contentType: "image/png",
			payload: data,
			metadata,
		};
	}

	/**
	 * return a JPEG response with optional metadata
	 */
	jpeg(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType {
		return {
			contentType: "image/jpeg",
			payload: data,
			metadata,
		};
	}

	/**
	 * return a GIF response with optional metadata
	 */
	gif(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType {
		return {
			contentType: "image/gif",
			payload: data,
			metadata,
		};
	}

	/**
	 * return a WebP response with optional metadata
	 */
	webp(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType {
		return {
			contentType: "image/webp",
			payload: data,
			metadata,
		};
	}

	/**
	 * return a MP3 response with optional metadata
	 */
	mp3(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType {
		return {
			contentType: "audio/mpeg",
			payload: data,
			metadata,
		};
	}

	/**
	 * return a MP4 response with optional metadata
	 */
	mp4(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType {
		return {
			contentType: "audio/mp4",
			payload: data,
			metadata,
		};
	}

	/**
	 * return a M4A response with optional metadata
	 */
	m4a(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType {
		return {
			contentType: "audio/m4a",
			payload: data,
			metadata,
		};
	}

	/**
	 * return a M4P response with optional metadata
	 */
	m4p(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType {
		return {
			contentType: "audio/m4p",
			payload: data,
			metadata,
		};
	}

	/**
	 * return a WebM response with optional metadata
	 */
	webm(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType {
		return {
			contentType: "audio/webm",
			payload: data,
			metadata,
		};
	}

	/**
	 * return a HTML response with optional metadata
	 */
	html(data: string, metadata?: Record<string, Json>): AgentResponseType {
		return {
			contentType: "text/html",
			payload: data,
			metadata,
		};
	}

	/**
	 * return a WAV response with optional metadata
	 */
	wav(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType {
		return {
			contentType: "audio/wav",
			payload: data,
			metadata,
		};
	}

	/**
	 * return a OGG response with optional metadata
	 */
	ogg(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType {
		return {
			contentType: "audio/ogg",
			payload: data,
			metadata,
		};
	}
}
