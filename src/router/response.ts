import type {
	AgentResponse,
	InvocationArguments,
	GetAgentRequestParams,
	Json,
	AgentResponseData,
	JsonObject,
	DataType,
	AgentRedirectResponse,
	ReadableDataType,
} from '../types';
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
	async handoff(
		agent: GetAgentRequestParams,
		args?: InvocationArguments
	): Promise<AgentRedirectResponse> {
		const result: AgentRedirectResponse = {
			redirect: true,
			agent,
			invocation: args,
		};
		return result;
	}

	/**
	 * return an empty response with optional metadata
	 */
	async empty(metadata?: JsonObject): Promise<AgentResponseData> {
		return {
			data: new DataHandler({
				contentType: 'text/plain',
				payload: '',
			}),
			metadata,
		};
	}

	/**
	 * return a JSON response with optional metadata
	 */
	async json(data: Json, metadata?: JsonObject): Promise<AgentResponseData> {
		return {
			data: new DataHandler({
				contentType: 'application/json',
				payload: Buffer.from(safeStringify(data)).toString('base64'),
			}),
			metadata,
		};
	}

	/**
	 * return a text response with optional metadata
	 */
	async text(data: string, metadata?: JsonObject): Promise<AgentResponseData> {
		return {
			data: new DataHandler({
				contentType: 'text/plain',
				payload: Buffer.from(data).toString('base64'),
			}),
			metadata,
		};
	}

	/**
	 * return a binary response with optional metadata
	 */
	binary(data: DataType, metadata?: JsonObject): Promise<AgentResponseData> {
		return fromDataType(data, 'application/octet-stream', metadata);
	}

	/**
	 * return a PDF response with optional metadata
	 */
	pdf(data: DataType, metadata?: JsonObject): Promise<AgentResponseData> {
		return fromDataType(data, 'application/pdf', metadata);
	}

	/**
	 * return a PNG response with optional metadata
	 */
	png(data: DataType, metadata?: JsonObject): Promise<AgentResponseData> {
		return fromDataType(data, 'image/png', metadata);
	}

	/**
	 * return a JPEG response with optional metadata
	 */
	jpeg(data: DataType, metadata?: JsonObject): Promise<AgentResponseData> {
		return fromDataType(data, 'image/jpeg', metadata);
	}

	/**
	 * return a GIF response with optional metadata
	 */
	gif(data: DataType, metadata?: JsonObject): Promise<AgentResponseData> {
		return fromDataType(data, 'image/gif', metadata);
	}

	/**
	 * return a WebP response with optional metadata
	 */
	webp(data: DataType, metadata?: JsonObject): Promise<AgentResponseData> {
		return fromDataType(data, 'image/webp', metadata);
	}

	/**
	 * return a MP3 response with optional metadata
	 */
	mp3(data: DataType, metadata?: JsonObject): Promise<AgentResponseData> {
		return fromDataType(data, 'audio/mpeg', metadata);
	}

	/**
	 * return a MP4 response with optional metadata
	 */
	mp4(data: DataType, metadata?: JsonObject): Promise<AgentResponseData> {
		return fromDataType(data, 'audio/mp4', metadata);
	}

	/**
	 * return a M4A response with optional metadata
	 */
	m4a(data: DataType, metadata?: JsonObject): Promise<AgentResponseData> {
		return fromDataType(data, 'audio/m4a', metadata);
	}

	/**
	 * return a M4P response with optional metadata
	 */
	m4p(data: DataType, metadata?: JsonObject): Promise<AgentResponseData> {
		return fromDataType(data, 'audio/m4p', metadata);
	}

	/**
	 * return a WebM response with optional metadata
	 */
	webm(data: DataType, metadata?: JsonObject): Promise<AgentResponseData> {
		return fromDataType(data, 'audio/webm', metadata);
	}

	/**
	 * return a HTML response with optional metadata
	 */
	async html(data: string, metadata?: JsonObject): Promise<AgentResponseData> {
		return {
			data: new DataHandler({
				contentType: 'text/html',
				payload: Buffer.from(safeStringify(data)).toString('base64'),
			}),
			metadata,
		};
	}

	/**
	 * return a WAV response with optional metadata
	 */
	wav(data: DataType, metadata?: JsonObject): Promise<AgentResponseData> {
		return fromDataType(data, 'audio/wav', metadata);
	}

	/**
	 * return an OGG response with optional metadata
	 */
	ogg(data: DataType, metadata?: JsonObject): Promise<AgentResponseData> {
		return fromDataType(data, 'audio/ogg', metadata);
	}

	/**
	 * stream a response to the client
	 */
	async stream(
		stream: ReadableStream<ReadableDataType> | AsyncIterable<ReadableDataType>,
		contentType?: string
	): Promise<AgentResponseData> {
		return {
			data: new DataHandler(
				{
					contentType: contentType ?? 'text/plain',
				},
				stream
			),
		};
	}

	/**
	 * return a response with specific data and content type with optional metadata
	 */
	data(
		data: DataType,
		contentType: string,
		metadata?: JsonObject
	): Promise<AgentResponseData> {
		return fromDataType(data, contentType, metadata);
	}

	/**
	 * return a markdown response with optional metadata
	 */
	async markdown(content: string, metadata?: JsonObject): Promise<AgentResponseData> {
		return {
			data: new DataHandler({
				contentType: 'text/markdown',
				payload: Buffer.from(content).toString('base64'),
			}),
			metadata,
		};
	}
}
