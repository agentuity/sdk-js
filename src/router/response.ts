import type {
	AgentResponse,
	InvocationArguments,
	GetAgentRequestParams,
	AgentResponseData,
	JsonObject,
	DataType,
	AgentRedirectResponse,
	ReadableDataType,
} from '../types';
import { isJsonObject } from '../types';
import type { ReadableStream } from 'node:stream/web';
import { DataHandler } from './data';
import { safeStringify, fromDataType } from '../server/util';

/**
 * The AgentResponse class implements the AgentResponseHandler interface.
 * It is used to create and return responses from an agent.
 */
export default class AgentResponseHandler implements AgentResponse {
	/**
	 * redirect the current request another agent within the same project
	 */
	async handoff<M = unknown>(
		agent: GetAgentRequestParams,
		args?: InvocationArguments
	): Promise<AgentRedirectResponse> {
		if (isJsonObject(args?.metadata)) {
			const result: AgentRedirectResponse = {
				redirect: true,
				agent,
				invocation: args as JsonObject,
			};
			return result;
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return an empty response with optional metadata
	 */
	async empty<M = unknown>(metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return {
				data: new DataHandler('', 'text/plain'),
				metadata,
			};
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a JSON response with optional metadata
	 */
	async json<T = unknown, M = unknown>(
		data: T,
		metadata?: M
	): Promise<AgentResponseData> {
		if (!isJsonObject(data)) {
			throw new Error('data must be a JsonObject');
		}
		if (isJsonObject(metadata)) {
			return {
				data: new DataHandler(safeStringify(data), 'application/json'),
				metadata,
			};
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a text response with optional metadata
	 */
	async text<M = unknown>(
		data: string,
		metadata?: M
	): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return {
				data: new DataHandler(data, 'text/plain'),
				metadata,
			};
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a binary response with optional metadata
	 */
	binary<M = unknown>(
		data: DataType,
		metadata?: M
	): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'application/octet-stream', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a PDF response with optional metadata
	 */
	pdf<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'application/pdf', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a PNG response with optional metadata
	 */
	png<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'image/png', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a JPEG response with optional metadata
	 */
	jpeg<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'image/jpeg', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a GIF response with optional metadata
	 */
	gif<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'image/gif', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a WebP response with optional metadata
	 */
	webp<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'image/webp', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a MP3 response with optional metadata
	 */
	mp3<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'audio/mpeg', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a MP4 response with optional metadata
	 */
	mp4<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'audio/mp4', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a M4A response with optional metadata
	 */
	m4a<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'audio/m4a', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a M4P response with optional metadata
	 */
	m4p<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'audio/m4p', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a WebM response with optional metadata
	 */
	webm<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'audio/webm', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a HTML response with optional metadata
	 */
	async html<M = unknown>(
		data: string,
		metadata?: M
	): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return {
				data: new DataHandler(data, 'text/html'),
				metadata,
			};
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a WAV response with optional metadata
	 */
	wav<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'audio/wav', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return an OGG response with optional metadata
	 */
	ogg<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, 'audio/ogg', metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * stream a response to the client
	 */
	async stream<M = unknown>(
		stream: ReadableStream<ReadableDataType> | AsyncIterable<ReadableDataType>,
		contentType?: string,
		metadata?: M
	): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return {
				data: new DataHandler(
					stream,
					contentType ?? 'application/octet-stream'
				),
				metadata,
			};
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a response with specific data and content type with optional metadata
	 */
	data<M = unknown>(
		data: DataType,
		contentType: string,
		metadata?: M
	): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return fromDataType(data, contentType, metadata);
		}
		throw new Error('metadata must be a JsonObject');
	}

	/**
	 * return a markdown response with optional metadata
	 */
	async markdown<M = unknown>(
		content: string,
		metadata?: M
	): Promise<AgentResponseData> {
		if (isJsonObject(metadata)) {
			return {
				data: new DataHandler(content, 'text/markdown'),
				metadata,
			};
		}
		throw new Error('metadata must be a JsonObject');
	}
}
