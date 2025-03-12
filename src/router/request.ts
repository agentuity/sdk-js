import type { AgentRequest, Json, DataPayload } from '../types';
import { DataHandler } from './data';

/**
 * Handles agent requests and provides methods to access request data in various formats
 */
export default class AgentRequestHandler implements AgentRequest {
	private readonly request: DataPayload;
	private readonly datahandler: DataHandler;

	constructor(request: DataPayload) {
		this.request = request;
		this.datahandler = new DataHandler(request);
	}

	/**
	 * get the trigger of the request
	 */
	get trigger() {
		return this.request.trigger;
	}

	/**
	 * get the data of the request
	 */
	get data() {
		return this.datahandler;
	}

	/**
	 * get the metadata object of the request
	 */
	get metadata() {
		return this.request.metadata ?? {};
	}

	/**
	 * get the metadata value of the request with proper typing based on the trigger type
	 * @param key - the key to get the value of
	 * @param defaultValue - the default value to return if the key is not found
	 */
	get<K extends string>(key: K, defaultValue?: Json): any {
		const metadata = this.metadata;
		if (key in metadata) {
			return metadata[key];
		}
		return defaultValue ?? null;
	}
}
