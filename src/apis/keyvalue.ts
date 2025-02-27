import type { Json, KeyValueStorage } from '../types';
import { DELETE, GET, PUT, type Body } from './api';
import { getTracer, recordException } from '../router/router';

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
	async get(name: string, key: string): Promise<ArrayBuffer | null> {
		const tracer = getTracer();
		return new Promise<ArrayBuffer | null>((resolve, reject) => {
			tracer.startActiveSpan('agentuity.keyvalue.get', async (span) => {
				try {
					span.setAttribute('name', name);
					span.setAttribute('key', key);
					const resp = await GET(
						`/sdk/kv/${encodeURIComponent(name)}/${encodeURIComponent(key)}`,
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
						`error getting keyvalue: ${resp.response.statusText} (${resp.response.status})`
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
		value: ArrayBuffer | string | Json,
		ttl?: number
	): Promise<void> {
		const tracer = getTracer();
		tracer.startActiveSpan('agentuity.keyvalue.set', async (span) => {
			span.setAttribute('name', name);
			span.setAttribute('key', key);
			if (ttl) {
				span.setAttribute('ttl', ttl);
			}
			try {
				let body: Body | undefined;
				let contentType: string;
				if (typeof value === 'string') {
					body = value;
					contentType = 'text/plain';
				} else if (typeof value === 'object') {
					if (value instanceof ArrayBuffer) {
						body = value;
						contentType = 'application/octet-stream';
					} else {
						body = JSON.stringify(value);
						contentType = 'application/json';
					}
				} else {
					throw new Error(
						'Invalid value type. Expected either string, ArrayBuffer or object'
					);
				}
				let ttlstr = '';
				if (ttl) {
					if (ttl < 60) {
						throw new Error(
							`ttl for keyvalue set must be at least 60 seconds, got ${ttl}`
						);
					}
					ttlstr = `/${ttl}`;
				}
				const resp = await PUT(
					`/sdk/kv/${encodeURIComponent(name)}/${encodeURIComponent(key)}${ttlstr}`,
					body,
					{
						'Content-Type': contentType,
					}
				);
				if (resp.status !== 201) {
					throw new Error(
						`error setting keyvalue: ${resp.response.statusText} (${resp.response.status})`
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
	 * delete a value from the key value storage
	 *
	 * @param name - the name of the key value storage
	 * @param key - the key to delete
	 */
	async delete(name: string, key: string): Promise<void> {
		const tracer = getTracer();
		tracer.startActiveSpan('agentuity.keyvalue.delete', async (span) => {
			span.setAttribute('name', name);
			span.setAttribute('key', key);
			try {
				const resp = await DELETE(
					`/sdk/kv/${encodeURIComponent(name)}/${encodeURIComponent(key)}`
				);
				if (resp.status !== 200) {
					throw new Error(
						`error deleting keyvalue: ${resp.response.statusText} (${resp.response.status})`
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
