import type {
	DataResult,
	DataResultFound,
	DataResultNotFound,
	DataType,
	KeyValueStorage,
	KeyValueStorageSetParams,
} from '../types';
import { DELETE, GET, PUT } from './api';
import { getTracer, recordException } from '../router/router';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import { fromDataType } from '../server/util';
import { DataHandler } from '../router/data';
import { gzipString } from '../server/gzip';

/**
 * Implementation of the KeyValueStorage interface for interacting with the key-value storage API
 */
export default class KeyValueAPI implements KeyValueStorage {
	/**
	 * get a value from the key value storage
	 *
	 * @param name - the name of the key value storage
	 * @param key - the key to get the value of
	 * @returns the value of the key
	 */
	async get(name: string, key: string): Promise<DataResult> {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan('agentuity.keyvalue.get', {}, currentContext);

		try {
			span.setAttribute('name', name);
			span.setAttribute('key', key);

			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				const resp = await GET(
					`/kv/${encodeURIComponent(name)}/${encodeURIComponent(key)}`,
					true
				);
				if (resp.status === 404) {
					span.addEvent('miss');
					span.setStatus({ code: SpanStatusCode.OK });
					return { exists: false } as DataResultNotFound;
				}
				if (resp.status === 200) {
					const buffer = await Buffer.from(await resp.response.arrayBuffer());
					span.addEvent('hit');
					const result: DataResultFound = {
						exists: true,
						data: new DataHandler({
							payload: buffer.toString('base64'),
							contentType:
								resp.headers.get('content-type') ?? 'application/octet-stream',
						}),
					};
					span.setStatus({ code: SpanStatusCode.OK });
					return result;
				}
				throw new Error(
					`error getting keyvalue: ${resp.response.statusText} (${resp.response.status})`
				);
			});
		} catch (ex) {
			recordException(span, ex);
			throw ex;
		} finally {
			span.end();
		}
	}

	/**
	 * set a value in the key value storage
	 *
	 * @param name - the name of the key value storage
	 * @param key - the key to set the value of
	 * @param value - the value to set
	 * @param ttl - the time to live of the key
	 */
	async set(
		name: string,
		key: string,
		value: DataType,
		params?: KeyValueStorageSetParams
	): Promise<void> {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan('agentuity.keyvalue.set', {}, currentContext);

		try {
			span.setAttribute('name', name);
			span.setAttribute('key', key);
			if (params?.ttl) {
				span.setAttribute('ttl', params.ttl);
			}
			if (params?.contentType) {
				span.setAttribute('contentType', params.contentType);
			}

			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			await context.with(spanContext, async () => {
				const datavalue = await fromDataType(value, params?.contentType);
				let ttlstr = '';
				if (params?.ttl) {
					if (params.ttl < 60) {
						throw new Error(
							`ttl for keyvalue set must be at least 60 seconds, got ${params.ttl}`
						);
					}
					ttlstr = `/${params.ttl}`;
				}

				let base64 = datavalue.data.base64;

				const headers: Record<string, string> = {
					'Content-Type': datavalue.data.contentType,
				};

				if (
					datavalue.data.contentType.includes('text') ||
					datavalue.data.contentType.includes('json')
				) {
					const compressed = await gzipString(datavalue.data.text);
					base64 = compressed.toString('base64');
					headers['Content-Encoding'] = 'gzip';
				}

				const resp = await PUT(
					`/kv/${encodeURIComponent(name)}/${encodeURIComponent(key)}${ttlstr}`,
					Buffer.from(base64, 'base64').buffer,
					headers
				);

				if (resp.status !== 201) {
					throw new Error(
						`error setting keyvalue: ${resp.response.statusText} (${resp.response.status})`
					);
				}
				span.setStatus({ code: SpanStatusCode.OK });
			});
		} catch (ex) {
			recordException(span, ex);
			throw ex;
		} finally {
			span.end();
		}
	}

	/**
	 * delete a value from the key value storage
	 *
	 * @param name - the name of the key value storage
	 * @param key - the key to delete
	 */
	async delete(name: string, key: string): Promise<void> {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan(
			'agentuity.keyvalue.delete',
			{},
			currentContext
		);

		try {
			span.setAttribute('name', name);
			span.setAttribute('key', key);

			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			await context.with(spanContext, async () => {
				const resp = await DELETE(
					`/kv/${encodeURIComponent(name)}/${encodeURIComponent(key)}`
				);
				if (resp.status !== 200) {
					throw new Error(
						`error deleting keyvalue: ${resp.response.statusText} (${resp.response.status})`
					);
				}
				span.setStatus({ code: SpanStatusCode.OK });
			});
		} catch (ex) {
			recordException(span, ex);
			throw ex;
		} finally {
			span.end();
		}
	}
}
