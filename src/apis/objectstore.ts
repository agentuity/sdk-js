import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { DataHandler } from '../router/data';
import { getTracer, recordException } from '../router/router';
import { fromDataType } from '../server/util';
import type {
	DataResult,
	DataResultFound,
	DataResultNotFound,
	DataType,
	ObjectStore,
	ObjectStorePutParams,
} from '../types';
import { isDataType } from '../types';
import { DELETE, GET, POST, PUT } from './api';

/**
 * Response for a successful object store create public URL operation
 */
interface ObjectStoreCreatePublicURLSuccessResponse {
	success: true;
	url: string;
}

/**
 * Response for a failed object store create public URL operation
 */
interface ObjectStoreCreatePublicURLErrorResponse {
	success: false;
	message: string;
}

/**
 * Response for an object store create public URL operation
 */
type ObjectStoreCreatePublicURLResponse =
	| ObjectStoreCreatePublicURLSuccessResponse
	| ObjectStoreCreatePublicURLErrorResponse;

/**
 * Implementation of the ObjectStore interface for interacting with the object storage API
 */
export default class ObjectStoreAPI implements ObjectStore {
	/**
	 * get an object from the object store
	 *
	 * @param bucket - the bucket to get the object from
	 * @param key - the key of the object to get
	 * @returns the data result from the object store
	 */
	async get(bucket: string, key: string): Promise<DataResult> {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan(
			'agentuity.objectstore.get',
			{},
			currentContext
		);

		try {
			span.setAttribute('bucket', bucket);
			span.setAttribute('key', key);

			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				const resp = await GET(
					`/object/2025-03-17/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`,
					true,
					undefined,
					undefined,
					'objectstore'
				);
				if (resp.status === 404) {
					span.addEvent('miss');
					span.setStatus({ code: SpanStatusCode.OK });
					return { exists: false } as DataResultNotFound;
				}
				if (resp.status === 200) {
					span.addEvent('hit');
					const body = Buffer.from(await resp.response.arrayBuffer());
					const result: DataResultFound = {
						exists: true,
						data: new DataHandler(
							body,
							resp.headers.get('content-type') ?? 'application/octet-stream'
						),
					};
					span.setStatus({ code: SpanStatusCode.OK });
					return result;
				}

				// Handle error response - body contains error message as text
				const errorMessage = await resp.response.text();
				throw new Error(
					errorMessage ||
						`error getting object: ${resp.response.statusText} (${resp.response.status})`
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
	 * put an object into the object store
	 *
	 * @param bucket - the bucket to put the object into
	 * @param key - the key of the object to put
	 * @param data - the data to put
	 * @param params - the object store put parameters
	 */
	async put(
		bucket: string,
		key: string,
		data: DataType,
		params?: ObjectStorePutParams
	): Promise<void> {
		if (!isDataType(data)) {
			throw new Error('data must be a DataType');
		}

		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan(
			'agentuity.objectstore.put',
			{},
			currentContext
		);

		try {
			span.setAttribute('bucket', bucket);
			span.setAttribute('key', key);
			if (params?.contentType) {
				span.setAttribute('contentType', params.contentType);
			}
			if (params?.contentEncoding) {
				span.setAttribute('contentEncoding', params.contentEncoding);
			}

			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			await context.with(spanContext, async () => {
				const datavalue = await fromDataType(data, params?.contentType);

				// Get the stream directly instead of loading into memory
				const stream = await datavalue.data.stream();

				const headers: Record<string, string> = {
					'Content-Type': datavalue.data.contentType,
				};

				if (params?.contentEncoding) {
					headers['Content-Encoding'] = params.contentEncoding;
				}

				if (params?.cacheControl) {
					headers['Cache-Control'] = params.cacheControl;
				}

				if (params?.contentDisposition) {
					headers['Content-Disposition'] = params.contentDisposition;
				}

				if (params?.contentLanguage) {
					headers['Content-Language'] = params.contentLanguage;
				}

				if (params?.metadata) {
					for (const [key, value] of Object.entries(params.metadata)) {
						headers[`x-metadata-${key}`] = value;
					}
				}

				const resp = await PUT(
					`/object/2025-03-17/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`,
					stream as unknown as ReadableStream,
					headers,
					undefined,
					'objectstore'
				);

				if (resp.status >= 200 && resp.status < 300) {
					span.setStatus({ code: SpanStatusCode.OK });
					return;
				}

				// Handle error response - body contains error message as text
				let errorMessage = '';
				try {
					errorMessage = await resp.response.text();
				} catch (_textError) {
					// If we can't read the response text, use the status text
					errorMessage = resp.response.statusText;
				}

				throw new Error(
					errorMessage ||
						`error putting object: ${resp.response.statusText} (${resp.response.status})`
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
	 * delete an object from the object store
	 *
	 * @param bucket - the bucket to delete the object from
	 * @param key - the key of the object to delete
	 * @returns true if the object was deleted, false if the object did not exist
	 */
	async delete(bucket: string, key: string): Promise<boolean> {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan(
			'agentuity.objectstore.delete',
			{},
			currentContext
		);

		try {
			span.setAttribute('bucket', bucket);
			span.setAttribute('key', key);

			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				const resp = await DELETE(
					`/object/2025-03-17/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`,
					undefined,
					undefined,
					undefined,
					'objectstore'
				);
				if (resp.status === 200) {
					span.addEvent('deleted', { deleted: true });
					span.setStatus({ code: SpanStatusCode.OK });
					return true;
				}
				if (resp.status === 404) {
					span.addEvent('not_found', { deleted: false });
					span.setStatus({ code: SpanStatusCode.OK });
					return false;
				}

				// Handle error response - body contains error message as text
				const errorMessage = await resp.response.text();
				throw new Error(
					errorMessage ||
						`error deleting object: ${resp.response.statusText} (${resp.response.status})`
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
	 * create a public URL for an object
	 *
	 * @param bucket - the bucket to create the signed URL for
	 * @param key - the key of the object to create the signed URL for
	 * @param expiresDuration - the duration of the signed URL in milliseconds
	 * @returns the public URL
	 */
	async createPublicURL(
		bucket: string,
		key: string,
		expiresDuration?: number
	): Promise<string> {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan(
			'agentuity.objectstore.createPublicURL',
			{},
			currentContext
		);

		try {
			span.setAttribute('bucket', bucket);
			span.setAttribute('key', key);
			if (expiresDuration) {
				span.setAttribute('expiresDuration', expiresDuration);
			}

			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				const path = `/object/2025-03-17/presigned/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`;

				const requestBody: { expires?: number } = {};
				if (expiresDuration) {
					requestBody.expires = expiresDuration;
				}

				const resp = await POST<ObjectStoreCreatePublicURLResponse>(
					path,
					JSON.stringify(requestBody),
					undefined,
					undefined,
					undefined,
					'objectstore'
				);

				if (resp.status === 200) {
					if (resp.json?.success) {
						span.setStatus({ code: SpanStatusCode.OK });
						return resp.json.url;
					}
				}
				if (!resp.json?.success && resp.json?.message) {
					throw new Error(resp.json.message);
				}
				throw new Error(
					`error creating public URL: ${resp.response.statusText} (${resp.response.status})`
				);
			});
		} catch (ex) {
			recordException(span, ex);
			throw ex;
		} finally {
			span.end();
		}
	}
}
