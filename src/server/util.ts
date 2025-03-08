import { DataHandler } from '../router/data';
import type { AgentResponseData, DataType, Data, JsonObject } from '../types';
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
					payload: data.toString('base64'),
				}),
				metadata,
			};
		}
		if (data instanceof ReadableStream) {
			const reader = data.getReader();
			const chunks: string[] = [];
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(value);
			}
			return {
				data: new DataHandler({
					contentType: contentType ?? 'application/octet-stream',
					payload: Buffer.from(chunks.join('')).toString('base64'),
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
