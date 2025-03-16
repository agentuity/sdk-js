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
} from '../types';
import { injectTraceContextToHeaders } from './otel';
import type { ServerRoute } from './types';

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
	if (data === null || data === undefined) {
		return {
			data: new DataHandler({
				contentType: contentType ?? 'text/plain',
				payload: '',
			}),
			metadata,
		};
	}
	if (typeof data === 'string') {
		return {
			data: new DataHandler({
				contentType: contentType ?? 'text/plain',
				payload: Buffer.from(data).toString('base64'),
			}),
			metadata,
		};
	}
	if (typeof data === 'object') {
		if ('contentType' in data) {
			const value = data as Data;
			return {
				data: new DataHandler({
					contentType: value.contentType,
					payload: value.base64,
				}),
				metadata,
			};
		}
		if (data instanceof ArrayBuffer) {
			return {
				data: new DataHandler({
					contentType: contentType ?? 'application/octet-stream',
					payload: Buffer.from(data).toString('base64'),
				}),
				metadata,
			};
		}
		if (data instanceof Buffer) {
			return {
				data: new DataHandler({
					contentType: contentType ?? 'application/octet-stream',
					payload: data.toString('base64'),
				}),
				metadata,
			};
		}
		if (data instanceof Blob) {
			return {
				data: new DataHandler({
					contentType: contentType ?? 'application/octet-stream',
					payload: data.toString('base64'),
				}),
				metadata,
			};
		}
		if (data instanceof Uint8Array) {
			return {
				data: new DataHandler({
					contentType: contentType ?? 'application/octet-stream',
					payload: Buffer.from(data).toString('base64'),
				}),
				metadata,
			};
		}
		if (data instanceof ReadableStream) {
			const reader = data.getReader();
			let buffer: Uint8Array = new Uint8Array();
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer = new Uint8Array([...buffer, ...value]);
			}
			return {
				data: new DataHandler({
					contentType: contentType ?? 'application/octet-stream',
					payload: Buffer.from(buffer).toString('base64'),
				}),
				metadata,
			};
		}
		return {
			data: new DataHandler({
				contentType: contentType ?? 'application/json',
				payload: Buffer.from(safeStringify(data)).toString('base64'),
			}),
			metadata,
		};
	}

	throw new Error('Invalid data type');
}

// a few bits of the code here are taken from https://github.com/marceljuenemann/base64-stream
// https://github.com/mazira/base64-stream/blob/master/lib/encode.js
export class Base64StreamHelper {
	private extra: Buffer | null = null;

	push(_chunk: Buffer) {
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
			return this.push(this.extra);
		}
		return '';
	}
}

export function createStreamingResponse(
	server: string,
	headers: Headers,
	span: Span,
	routeResult: Promise<AgentResponseData>
): [Record<string, string>, ReadableStream] {
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
		responseheaders['Content-Type'] = 'application/json';
		span.setAttribute('http.sse', 'false');
	}
	span.setAttribute('http.status_code', '200');
	span.setStatus({ code: SpanStatusCode.OK });
	return [
		responseheaders,
		new ReadableStream({
			start(controller) {
				routeResult
					.then(async (resp) => {
						let encoding = 'base64';
						if (streamAsSSE) {
							encoding = (headers.get('accept-encoding') ??
								'utf-8') as BufferEncoding;
						} else {
							controller.enqueue(
								`{"contentType":"${resp.data.contentType}","metadata":${JSON.stringify(resp.metadata ?? null)},"payload":"`
							);
						}
						const helper = new Base64StreamHelper();
						const reader = resp.data.stream.getReader();
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;
							const data = await toBuffer(value);
							if (streamAsSSE) {
								const buf = Buffer.from(
									`data: ${data.toString(encoding as BufferEncoding)}\n`,
									'utf-8'
								);
								controller.enqueue(buf);
							} else {
								if (encoding === 'base64') {
									controller.enqueue(helper.push(data));
								} else {
									controller.enqueue(data.toString(encoding as BufferEncoding));
								}
							}
						}
						if (!streamAsSSE) {
							if (encoding === 'base64') {
								controller.enqueue(helper.flush());
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
