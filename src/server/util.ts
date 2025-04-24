import { SpanStatusCode } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';
import { DataHandler } from '../router/data';
import type {
	AgentResponseData,
	DataType,
	Data,
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
		buffer.push(`${route.method} /run${route.path} [${route.agent.name}]`);
	}
	buffer.push('');
	if (process.platform === 'darwin' || process.platform === 'linux') {
		buffer.push('Example usage:');
		buffer.push('');
		buffer.push(
			`curl http://${host}/run${routes[0].path} \\\n\t--json '{"prompt":"Hello"}'`
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

export async function createStreamingResponse(
	server: string,
	span: Span,
	routeResult: Promise<AgentResponseData>
): Promise<[Record<string, string>, ReadableStream]> {
	const responseheaders = injectTraceContextToHeaders({
		Server: server,
	});

	const resp = await routeResult;
	if (resp.metadata) {
		for (const key in resp.metadata) {
			let value = resp.metadata[key] as string;
			if (
				value &&
				value.charAt(0) === '{' &&
				value.charAt(value.length - 1) === '}'
			) {
				value = safeParse(value, value);
			}
			responseheaders[`x-agentuity-${key}`] = value;
		}
	}
	responseheaders['Content-Type'] = resp.data.contentType;

	span.setStatus({ code: SpanStatusCode.OK });

	return [
		responseheaders,
		new ReadableStream({
			async start(controller) {
				const stream = await resp.data.stream();
				const reader = stream.getReader();
				while (true) {
					const { done, value } = await reader.read();
					if (value) {
						controller.enqueue(value);
					}
					if (done) break;
				}
				controller.close();
			},
		}),
	];
}

export function getRequestFromHeaders(
	headers: Record<string, string>,
	runId: string
): IncomingRequest {
	const metadata = metadataFromHeaders(headers);
	const trigger = metadata.trigger as TriggerType;
	let scope: AgentInvocationScope = 'local';
	if ('scope' in metadata) {
		scope = metadata.scope as AgentInvocationScope;
		// biome-ignore lint/performance/noDelete: deleting scope
		delete metadata.scope;
	}
	if ('scope' in metadata) {
		scope = metadata.scope as AgentInvocationScope;
		// biome-ignore lint/performance/noDelete: deleting scope
		delete metadata.scope;
	}
	// biome-ignore lint/performance/noDelete: deleting trigger
	delete metadata.trigger;
	return {
		contentType: headers['content-type'] ?? 'application/octet-stream',
		metadata,
		runId,
		trigger,
		scope,
	};
}

/**
 * Extracts metadata from headers
 *
 * @param headers - The headers to extract metadata from
 * @returns The metadata
 */
export function metadataFromHeaders(headers: Record<string, string>) {
	console.log('metadataFromHeaders>>', headers);
	const metadata: JsonObject = {};
	for (const [key, value] of Object.entries(headers)) {
		if (key.startsWith('x-agentuity-')) {
			if (key === 'x-agentuity-metadata') {
				const md = safeParse(value) as JsonObject;
				if (md) {
					for (const [k, v] of Object.entries(md)) {
						metadata[k] = v;
					}
				}
				continue;
			}
			const mdkey = key.substring(12);
			if (value.charAt(0) === '{' && value.charAt(value.length - 1) === '}') {
				metadata[mdkey] = safeParse(value);
			} else {
				metadata[mdkey] = value;
			}
		}
	}
	if (
		'headers' in metadata &&
		typeof metadata.headers === 'object' &&
		metadata.headers
	) {
		// check to see if we have embedded headers metadata and if so, merge it into the main metadata
		for (const [key, value] of Object.entries(metadata.headers)) {
			if (key.startsWith('x-agentuity-')) {
				if (typeof value === 'string') {
					const mdkey = key.substring(12);
					if (
						value.charAt(0) === '{' &&
						value.charAt(value.length - 1) === '}'
					) {
						metadata[mdkey] = safeParse(value);
					} else {
						metadata[mdkey] = value;
					}
					delete (metadata.headers as JsonObject)[key];
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
