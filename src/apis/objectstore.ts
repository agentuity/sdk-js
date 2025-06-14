import type { ObjectStore, ObjectStorePutParams } from '../types';
import { DELETE, GET, PUT, type Body } from './api';
import { getTracer, recordException } from '../router/router';

export default class ObjectStoreAPI implements ObjectStore {
	/**
	 * put an object into the object storage
	 *
	 * @param name - the name of the object storage
	 * @param key - the key to store the object under
	 * @param value - the value to store
	 * @param params - optional parameters for the put operation
	 */
	async put(
		name: string,
		key: string,
		value: ArrayBuffer | string,
		params?: ObjectStorePutParams
	): Promise<void> {
		const tracer = getTracer();
		tracer.startActiveSpan('agentuity.objectstore.put', async (span) => {
			span.setAttribute('name', name);
			span.setAttribute('key', key);
			try {
				let body: Body;
				const headers: Record<string, string> = {};

				if (typeof value === 'string') {
					body = value;
					headers['Content-Type'] = params?.contentType || 'text/plain';
				} else {
					body = value;
					headers['Content-Type'] =
						params?.contentType || 'application/octet-stream';
				}

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
					`/sdk/objectstore/${encodeURIComponent(name)}/${encodeURIComponent(key)}`,
					body,
					headers
				);
				if (resp.status !== 201) {
					throw new Error(
						`error putting object: ${resp.response.statusText} (${resp.response.status})`
					);
				}
			} catch (ex) {
				recordException(span, ex);
				throw ex;
			} finally {
				span.end();
			}
		});
	}

	/**
	 * get an object from the object storage
	 *
	 * @param name - the name of the object storage
	 * @param key - the key to get the object from
	 * @returns the object data
	 */
	async get(name: string, key: string): Promise<ArrayBuffer | null> {
		const tracer = getTracer();
		return new Promise<ArrayBuffer | null>((resolve, reject) => {
			tracer.startActiveSpan('agentuity.objectstore.get', async (span) => {
				try {
					span.setAttribute('name', name);
					span.setAttribute('key', key);
					const resp = await GET(
						`/sdk/objectstore/${encodeURIComponent(name)}/${encodeURIComponent(key)}`,
						true
					);
					if (resp.status === 404) {
						span.addEvent('miss');
						resolve(null);
						return;
					}
					if (resp.status === 200) {
						span.addEvent('hit');
						resolve(resp.response.arrayBuffer());
						return;
					}
					throw new Error(
						`error getting object: ${resp.response.statusText} (${resp.response.status})`
					);
				} catch (ex) {
					recordException(span, ex);
					reject(ex);
				} finally {
					span.end();
				}
			});
		});
	}

	/**
	 * delete an object from the object storage
	 *
	 * @param name - the name of the object storage
	 * @param key - the key to delete
	 */
	async delete(name: string, key: string): Promise<void> {
		const tracer = getTracer();
		tracer.startActiveSpan('agentuity.objectstore.delete', async (span) => {
			span.setAttribute('name', name);
			span.setAttribute('key', key);
			try {
				const resp = await DELETE(
					`/sdk/objectstore/${encodeURIComponent(name)}/${encodeURIComponent(key)}`
				);
				if (resp.status !== 200) {
					throw new Error(
						`error deleting object: ${resp.response.statusText} (${resp.response.status})`
					);
				}
			} catch (ex) {
				recordException(span, ex);
				throw ex;
			} finally {
				span.end();
			}
		});
	}
}
