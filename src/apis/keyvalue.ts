import type { Json, KeyValueStorage } from "../types";
import { DELETE, GET, PUT } from "./api";

export default class KeyValueAPI implements KeyValueStorage {
	/**
	 * get a value from the key value storage
	 *
	 * @param name - the name of the key value storage
	 * @param key - the key to get the value of
	 * @returns the value of the key
	 */
	async get<T = ArrayBuffer>(name: string, key: string): Promise<T | null> {
		const resp = await GET(
			`/sdk/kv/${encodeURIComponent(name)}/${encodeURIComponent(key)}`,
		);
		if (resp.status === 404) {
			return null;
		}
		if (resp.status === 200) {
			switch (resp.headers.get("Content-Type")) {
				case "application/json":
					return resp.json as T;
				case "text/plain":
					return resp.response.text() as T;
				default:
					return resp.response.arrayBuffer() as T;
			}
		}
		throw new Error(
			`error getting keyvalue: ${resp.response.statusText} (${resp.response.status})`,
		);
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
		ttl?: number,
	): Promise<void> {
		let body: Uint8Array;
		if (typeof value === "string") {
			body = new TextEncoder().encode(value);
		} else if (typeof value === "object") {
			if (value instanceof ArrayBuffer) {
				body = new Uint8Array(value);
			} else {
				body = new TextEncoder().encode(JSON.stringify(value));
			}
		} else {
			throw new Error("invalid value type");
		}
		const resp = await PUT(
			`/sdk/kv/${encodeURIComponent(name)}/${encodeURIComponent(key)}`,
			body,
		);
		if (resp.status !== 201) {
			throw new Error(
				`error setting keyvalue: ${resp.response.statusText} (${resp.response.status})`,
			);
		}
	}

	/**
	 * delete a value from the key value storage
	 *
	 * @param name - the name of the key value storage
	 * @param key - the key to delete
	 */
	async delete(name: string, key: string): Promise<void> {
		const resp = await DELETE(
			`/sdk/kv/${encodeURIComponent(name)}/${encodeURIComponent(key)}`,
		);
		if (resp.status !== 200) {
			throw new Error(
				`error deleting keyvalue: ${resp.response.statusText} (${resp.response.status})`,
			);
		}
	}
}
