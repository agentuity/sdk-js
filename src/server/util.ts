import { SpanStatusCode } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';
import { DataHandler } from '../router/data';
import type {
	AgentResponseData,
	DataType,
	JsonObject,
	ReadableDataType,
	TriggerType,
	AgentWelcomePrompt,
	AgentInvocationScope,
} from '../types';
import { injectTraceContextToHeaders } from './otel';
import type { IncomingRequest, ServerRoute } from './types';
import { ReadableStream } from 'node:stream/web';

export function safeStringify(obj: unknown) {
	const seen = new WeakSet();
	return JSON.stringify(obj, (key, value) => {
		if (typeof value === 'object' && value !== null) {
			if (seen.has(value)) {
				return '[Circular]';
			}
			seen.add(value);
		}
		return value;
	});
}

export function safeParse(text: string, defaultValue?: unknown) {
	try {
		if (!text || text.trim() === '') {
			return defaultValue;
		}
		return JSON.parse(text);
	} catch (error) {
		return defaultValue;
	}
}

export function getRoutesHelpText(host: string, routes: ServerRoute[]) {
	const buffer = ['The following Agent routes are available:', ''];
	for (const route of routes) {
		buffer.push(`${route.method} ${route.path} [${route.agent.name}]`);
	}
	buffer.push('');
	if (process.platform === 'darwin' || process.platform === 'linux') {
		buffer.push('Example usage:');
		buffer.push('');
		buffer.push(
			`curl http://${host}${routes[0].path} \\\n\t--json '{"prompt":"Hello"}'`
		);
		buffer.push('');
	}
	return buffer.join('\n');
}

export async function toBuffer(data: ReadableDataType) {
	if (data instanceof Buffer) {
		return data;
	}
	if (data instanceof Uint8Array) {
		return Buffer.from(data);
	}
	if (data instanceof ArrayBuffer) {
		return Buffer.from(data);
	}
	if (typeof data === 'string') {
		return Buffer.from(data, 'utf-8');
	}
	if (data instanceof Blob) {
		return Buffer.from(await data.arrayBuffer());
	}
	throw new Error('Invalid data type (toBuffer)');
}

const isBase64 =
	/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export async function toWelcomePrompt({
	data,
	contentType,
}: AgentWelcomePrompt): Promise<{ data: string; contentType: string }> {
	if (data instanceof Buffer) {
		return {
			data: data.toString('base64'),
			contentType,
		};
	}
	if (data instanceof Uint8Array) {
		return {
			data: Buffer.from(data).toString('base64'),
			contentType,
		};
	}
	if (data instanceof ArrayBuffer) {
		return {
			data: Buffer.from(data).toString('base64'),
			contentType,
		};
	}
	if (data instanceof Blob) {
		return {
			data: Buffer.from(await data.arrayBuffer()).toString('base64'),
			contentType,
		};
	}
	if (data instanceof ReadableStream) {
		const reader = data.getReader();
		let buffer = Buffer.alloc(0);
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer = Buffer.concat([buffer, value]);
		}
		return {
			data: buffer.toString('base64'),
			contentType,
		};
	}
	if (typeof data === 'string') {
		if (
			(contentType.includes('text/') || contentType.includes('json')) &&
			!isBase64.test(data)
		) {
			return {
				data: Buffer.from(data).toString('base64'),
				contentType,
			};
		}
		return {
			data,
			contentType,
		};
	}
	if (typeof data === 'object') {
		return {
			data: Buffer.from(safeStringify(data)).toString('base64'),
			contentType,
		};
	}
	throw new Error('Invalid data type (toWelcomePrompt');
}

export async function dataTypeToBuffer(args: DataType): Promise<Buffer> {
	if (args instanceof DataHandler) {
		const payload = args as DataHandler;
		return payload.buffer();
	}
	if (args === null || args === undefined) {
		return Buffer.alloc(0);
	}
	if (typeof args === 'string') {
		return Buffer.from(args, 'utf-8');
	}
	if (typeof args === 'object') {
		if (args instanceof DataHandler) {
			return args.buffer();
		}
		if (args instanceof ArrayBuffer) {
			return Buffer.from(args);
		}
		if (args instanceof Buffer) {
			return args;
		}
		if (args instanceof Blob) {
			const blob = await args.arrayBuffer();
			return Buffer.from(blob);
		}
		if (args instanceof Uint8Array) {
			return Buffer.from(args);
		}
		if (args instanceof ReadableStream) {
			const reader = args.getReader();
			let buffer = Buffer.alloc(0);
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer = Buffer.concat([buffer, value]);
			}
			return buffer;
		}
		return Buffer.from(safeStringify(args));
	}
	throw new Error('Invalid data type (toDataType)');
}

export async function fromDataType(
	data: DataType,
	contentType?: string,
	metadata?: JsonObject
): Promise<AgentResponseData> {
	if (data instanceof DataHandler) {
		return {
			data,
			metadata,
		};
	}
	const response: AgentResponseData = {
		data: null as unknown as DataHandler, // Will be set in each case
		metadata, // Always include metadata
	};

	if (data === null || data === undefined) {
		response.data = new DataHandler('', 'text/plain');
		return response;
	}

	if (typeof data === 'string') {
		response.data = new DataHandler(data, contentType ?? 'text/plain');
		return response;
	}

	if (typeof data === 'object') {
		if (data instanceof DataHandler) {
			response.data = data;
			return response;
		}

		if (data instanceof ArrayBuffer) {
			response.data = new DataHandler(
				Buffer.from(data),
				contentType ?? 'application/octet-stream'
			);
			return response;
		}

		if (data instanceof Buffer) {
			response.data = new DataHandler(
				data,
				contentType ?? 'application/octet-stream'
			);
			return response;
		}

		if (data instanceof Blob) {
			const buffer = await data.arrayBuffer();
			response.data = new DataHandler(
				Buffer.from(buffer),
				contentType ?? 'application/octet-stream'
			);
			return response;
		}

		if (data instanceof Uint8Array) {
			response.data = new DataHandler(
				Buffer.from(data),
				contentType ?? 'application/octet-stream'
			);
			return response;
		}

		if (data instanceof ReadableStream) {
			response.data = new DataHandler(
				data as unknown as ReadableStream<ReadableDataType>,
				contentType ?? 'application/octet-stream'
			);
			return response;
		}

		response.data = new DataHandler(
			safeStringify(data),
			contentType ?? 'application/json'
		);
		return response;
	}

	throw new Error('Invalid data type (fromDataType)');
}

const devmode = process.env.AGENTUITY_SDK_DEV_MODE === 'true';

export async function createStreamingResponse(
	origin: string | null,
	server: string,
	span: Span,
	routeResult: Promise<AgentResponseData>
): Promise<Response> {
	const responseheaders = injectTraceContextToHeaders({
		Server: server,
	});
	let resp: AgentResponseData;

	try {
		resp = await routeResult;
	} catch (error) {
		const { stack, message } = error as Error;
		let errorMessage = message;
		if (devmode) {
			errorMessage = stack ?? errorMessage;
		}
		responseheaders['Content-Type'] = 'text/plain';
		return new Response(errorMessage, {
			status: 500,
			headers: responseheaders,
		});
	}
	if (resp.metadata) {
		for (const key in resp.metadata) {
			let value = resp.metadata[key];
			if (typeof value === 'string') {
				value = safeParseIfLooksLikeJson(value) ?? value;
			} else {
				value = JSON.stringify(value);
			}
			responseheaders[`x-agentuity-${key}`] = value as string;
		}
	}
	if (resp.data?.contentType) {
		responseheaders['Content-Type'] = resp.data.contentType;
	}
	if (origin) {
		responseheaders['Access-Control-Allow-Origin'] = origin;
	} else {
		responseheaders['Access-Control-Allow-Origin'] = '*';
	}
	responseheaders['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
	responseheaders['Access-Control-Allow-Headers'] =
		'Content-Type, Authorization';

	if (resp instanceof Response) {
		for (const [key, value] of Object.entries(responseheaders)) {
			resp.headers.set(key, value);
		}
		return resp;
	}

	const stream = await resp.data.stream();

	span.setStatus({ code: SpanStatusCode.OK });

	return new Response(stream as unknown as BodyInit, {
		status: 200,
		headers: responseheaders,
	});
}

export function getRequestFromHeaders(
	headers: Record<string, string>,
	runId: string
): IncomingRequest {
	const metadata = metadataFromHeaders(headers);
	let trigger = metadata.trigger as TriggerType;
	let scope: AgentInvocationScope = 'local';
	if ('scope' in metadata) {
		scope = metadata.scope as AgentInvocationScope;
		// biome-ignore lint/performance/noDelete: deleting scope
		delete metadata.scope;
	}
	if ('trigger' in metadata) {
		trigger = metadata.trigger as TriggerType;
		// biome-ignore lint/performance/noDelete: deleting scope
		delete metadata.trigger;
	}
	// biome-ignore lint/performance/noDelete: deleting trigger
	delete metadata.trigger;
	return {
		contentType: headers['content-type'] ?? 'application/octet-stream',
		metadata,
		runId,
		trigger: trigger ?? 'manual',
		scope,
	};
}

function safeParseIfLooksLikeJson(value: unknown) {
	if (typeof value !== 'string') {
		return value;
	}
	if (value.charAt(0) === '{' && value.charAt(value.length - 1) === '}') {
		return safeParse(value);
	}
	if (value.charAt(0) === '[' && value.charAt(value.length - 1) === ']') {
		return safeParse(value);
	}
	return value;
}

/**
 * Extracts metadata from headers
 *
 * @param headers - The headers to extract metadata from
 * @returns The metadata
 */
export function metadataFromHeaders(headers: Record<string, string>) {
	const metadata: JsonObject = {};
	for (const [key, value] of Object.entries(headers)) {
		if (key.startsWith('x-agentuity-')) {
			switch (key) {
				case 'x-agentuity-metadata': {
					const md = safeParse(value) as JsonObject;
					if (md) {
						for (const [k, v] of Object.entries(md)) {
							metadata[k] = safeParseIfLooksLikeJson(v as string);
						}
					}
					continue;
				}
				case 'x-agentuity-headers': {
					const md = safeParse(value) as JsonObject;
					const kv: Record<string, string> = {};
					if ('content-type' in headers) {
						kv['content-type'] = headers['content-type'];
					}
					if (md) {
						for (const [k, v] of Object.entries(md)) {
							if (k.startsWith('x-agentuity-')) {
								metadata[k.substring(12)] = safeParseIfLooksLikeJson(
									v as string
								);
							} else {
								kv[k] = safeParseIfLooksLikeJson(v as string);
							}
						}
					}
					metadata.headers = kv;
					break;
				}
				default: {
					const mdkey = key.substring(12);
					if (
						value.charAt(0) === '{' &&
						value.charAt(value.length - 1) === '}'
					) {
						metadata[mdkey] = safeParse(value);
					} else {
						metadata[mdkey] = value;
					}
					break;
				}
			}
		}
	}
	return metadata;
}

export function setMetadataInHeaders(
	headers: Record<string, string>,
	metadata: JsonObject
) {
	for (const [key, value] of Object.entries(metadata)) {
		if (value === null || value === undefined) {
			continue;
		}
		switch (typeof value) {
			case 'string':
				headers[`x-agentuity-${key}`] = value;
				break;
			case 'number':
				headers[`x-agentuity-${key}`] = value.toString();
				break;
			case 'boolean':
				headers[`x-agentuity-${key}`] = value.toString();
				break;
			default:
				headers[`x-agentuity-${key}`] = safeStringify(value);
				break;
		}
	}
}

export function headersToRecord(headers: Headers): Record<string, string> {
	// Try using toJSON if available
	if (typeof headers.toJSON === 'function') {
		return headers.toJSON();
	}

	// Fallback for environments where toJSON is not available
	const record: Record<string, string> = {};
	headers.forEach((value, key) => {
		record[key] = value;
	});
	return record;
}
