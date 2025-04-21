import { SpanStatusCode } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';
import { DataHandler } from '../router/data';
import type {
	AgentResponseData,
	DataType,
	Data,
	JsonObject,
	ReadableDataType,
	InvocationArguments,
	TriggerType,
	AgentWelcomePrompt,
} from '../types';
import { injectTraceContextToHeaders } from './otel';
import type { IncomingRequest, ServerRoute } from './types';

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
	throw new Error('Invalid data type');
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
	throw new Error('Invalid data type');
}

export async function toDataType(
	trigger: TriggerType,
	args: InvocationArguments
): Promise<{
	trigger: TriggerType;
	payload: string;
	contentType: string;
	metadata?: JsonObject;
}> {
	if (args.data === null || args.data === undefined) {
		return {
			trigger,
			payload: '',
			contentType: 'text/plain',
			metadata: args.metadata,
		};
	}
	if (typeof args.data === 'string') {
		return {
			trigger,
			payload: Buffer.from(args.data).toString('base64'),
			contentType: 'text/plain',
			metadata: args.metadata,
		};
	}
	if (typeof args.data === 'object') {
		if ('contentType' in args.data) {
			const value = args.data as Data;
			return {
				trigger,
				payload: value.base64,
				contentType: value.contentType,
				metadata: args.metadata,
			};
		}
		if (args.data instanceof ArrayBuffer) {
			return {
				trigger,
				payload: Buffer.from(args.data).toString('base64'),
				contentType: args.contentType ?? 'application/octet-stream',
				metadata: args.metadata,
			};
		}
		if (args.data instanceof Buffer) {
			return {
				trigger,
				payload: args.data.toString('base64'),
				contentType: args.contentType ?? 'application/octet-stream',
				metadata: args.metadata,
			};
		}
		if (args.data instanceof Blob) {
			return {
				trigger,
				payload: Buffer.from(await args.data.arrayBuffer()).toString('base64'),
				contentType: args.contentType ?? 'application/octet-stream',
				metadata: args.metadata,
			};
		}
		if (args.data instanceof Uint8Array) {
			return {
				trigger,
				payload: Buffer.from(args.data).toString('base64'),
				contentType: args.contentType ?? 'application/octet-stream',
				metadata: args.metadata,
			};
		}
		if (args.data instanceof ReadableStream) {
			const reader = args.data.getReader();
			const chunks: string[] = [];
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(value);
			}
			return {
				trigger,
				payload: Buffer.from(chunks.join('')).toString('base64'),
				contentType: args.contentType ?? 'application/octet-stream',
				metadata: args.metadata,
			};
		}
		return {
			trigger,
			payload: Buffer.from(safeStringify(args.data)).toString('base64'),
			contentType: args.contentType ?? 'application/json',
			metadata: args.metadata,
		};
	}
	throw new Error('Invalid data type');
}

export async function fromDataType(
	data: DataType,
	contentType?: string,
	metadata?: JsonObject
): Promise<AgentResponseData> {
	const response: AgentResponseData = {
		data: null as unknown as DataHandler, // Will be set in each case
		metadata, // Always include metadata
	};

	if (data === null || data === undefined) {
		response.data = new DataHandler({
			contentType: contentType ?? 'text/plain',
			payload: '',
		});
		return response;
	}

	if (typeof data === 'string') {
		response.data = new DataHandler({
			contentType: contentType ?? 'text/plain',
			payload: Buffer.from(data).toString('base64'),
		});
		return response;
	}

	if (typeof data === 'object') {
		if ('contentType' in data) {
			const value = data as Data;
			response.data = new DataHandler({
				contentType: value.contentType,
				payload: value.base64,
			});
			return response;
		}

		if (data instanceof ArrayBuffer) {
			response.data = new DataHandler({
				contentType: contentType ?? 'application/octet-stream',
				payload: Buffer.from(data).toString('base64'),
			});
			return response;
		}

		if (data instanceof Buffer) {
			response.data = new DataHandler({
				contentType: contentType ?? 'application/octet-stream',
				payload: data.toString('base64'),
			});
			return response;
		}

		if (data instanceof Blob) {
			response.data = new DataHandler({
				contentType: contentType ?? 'application/octet-stream',
				payload: Buffer.from(await data.arrayBuffer()).toString('base64'),
			});
			return response;
		}

		if (data instanceof Uint8Array) {
			response.data = new DataHandler({
				contentType: contentType ?? 'application/octet-stream',
				payload: Buffer.from(data).toString('base64'),
			});
			return response;
		}

		if (data instanceof ReadableStream) {
			const reader = data.getReader();
			let buffer: Uint8Array = new Uint8Array();
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer = new Uint8Array([...buffer, ...value]);
			}
			response.data = new DataHandler({
				contentType: contentType ?? 'application/octet-stream',
				payload: Buffer.from(buffer).toString('base64'),
			});
			return response;
		}

		response.data = new DataHandler({
			contentType: contentType ?? 'application/json',
			payload: Buffer.from(safeStringify(data)).toString('base64'),
		});
		return response;
	}

	throw new Error('Invalid data type');
}

// a few bits of the code here are taken from https://github.com/marceljuenemann/base64-stream
// https://github.com/mazira/base64-stream/blob/master/lib/encode.js
export class Base64StreamHelper {
	private extra: Buffer | null = null;

	push(_chunk: Buffer): string {
		let chunk = _chunk;
		if (this.extra) {
			chunk = Buffer.concat([this.extra, _chunk]);
			this.extra = null;
		}

		// 3 bytes are represented by 4 characters, so we can only encode in groups of 3 bytes
		const remaining = chunk.length % 3;

		if (remaining !== 0) {
			// Store the extra bytes for later
			this.extra = Buffer.from(chunk.subarray(chunk.length - remaining));
			chunk = Buffer.from(chunk.subarray(0, chunk.length - remaining));
		}

		return chunk.toString('base64');
	}
	flush(): string {
		if (this.extra) {
			const value = this.extra.toString('base64');
			this.extra = null;
			return value;
		}
		return '';
	}
}

export async function createStreamingResponse(
	server: string,
	headers: Headers,
	span: Span,
	routeResult: Promise<AgentResponseData>,
	binary?: boolean
): Promise<[Record<string, string>, ReadableStream]> {
	const responseheaders = injectTraceContextToHeaders({
		Server: server,
	});

	const streamAsSSE = headers.get('accept')?.includes('text/event-stream');

	if (streamAsSSE) {
		responseheaders['Content-Type'] = 'text/event-stream;charset=utf-8';
		responseheaders['Cache-Control'] = 'no-cache, no-transform';
		responseheaders.Connection = 'keep-alive';
		responseheaders['X-Accel-Buffering'] = 'no';
		span.setAttribute('http.sse', 'true');
	} else {
		span.setAttribute('http.sse', 'false');
	}
	span.setAttribute('http.status_code', '200');
	span.setStatus({ code: SpanStatusCode.OK });
	// binary is the new protocol for streaming
	if (binary) {
		const resp = await routeResult;
		if (resp.metadata) {
			for (const key in resp.metadata) {
				responseheaders[`x-agentuity-${key}`] = resp.metadata[key] as string;
			}
		}
		responseheaders['Content-Type'] = resp.data.contentType;
		return [
			responseheaders,
			new ReadableStream({
				async start(controller) {
					const reader = resp.data.stream.getReader();
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						controller.enqueue(value);
					}
					controller.close();
				},
			}),
		];
	}
	// this is the old protocol for streaming which will be deprecated and removed in a future version
	responseheaders['Content-Type'] = 'application/json';
	return [
		responseheaders,
		new ReadableStream({
			start(controller) {
				routeResult
					.then(async (resp) => {
						const helper = new Base64StreamHelper();
						if (!streamAsSSE) {
							controller.enqueue(
								`{"contentType":"${resp.data.contentType}","metadata":${JSON.stringify(resp.metadata ?? null)},"payload":"`
							);
						}
						const reader = resp.data.stream.getReader();
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;
							const data = await toBuffer(value);
							if (!data || data.length === 0) {
								continue;
							}
							if (streamAsSSE) {
								const buf = Buffer.from(
									`data: ${data.toString('utf-8')}\n\n`,
									'utf-8'
								);
								controller.enqueue(buf);
							} else {
								controller.enqueue(helper.push(data));
							}
						}
						if (!streamAsSSE) {
							const output = helper.flush();
							if (output) {
								controller.enqueue(output);
							}
							controller.enqueue('"}');
						}
						controller.close();
					})
					.catch((err) => {
						span.recordException(err as Error);
						span.setStatus({
							code: SpanStatusCode.ERROR,
							message: err.message,
						});
						controller.error(err);
					});
			},
			cancel(controller: ReadableStreamDefaultController) {
				controller.close();
			},
		}),
	];
}

export function getRequestFromHeaders(
	headers: Record<string, string>
): IncomingRequest {
	let trigger: TriggerType = 'manual';
	const metadata: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		if (key.startsWith('x-agentuity-')) {
			const name = key.slice(12);
			if (name === 'trigger') {
				trigger = value as TriggerType;
			} else {
				metadata[name] = value;
			}
		}
	}
	return {
		trigger,
		metadata,
		contentType: headers['content-type'] ?? 'application/octet-stream',
		payload: '',
		runId: '',
	};
}
