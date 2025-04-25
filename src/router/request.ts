import type { ReadableStream } from 'node:stream/web';
import type {
	AgentRequest,
	Json,
	JsonObject,
	ReadableDataType,
	TriggerType,
} from '../types';
import { DataHandler } from './data';

/**
 * Handles agent requests and provides methods to access request data in various formats
 */
export default class AgentRequestHandler implements AgentRequest {
	private readonly _trigger: TriggerType;
	private readonly _datahandler: DataHandler;
	private readonly _metadata: JsonObject;

	/**
	 * constructor
	 *
	 * @param trigger - The trigger of the request
	 * @param stream - The stream of the request
	 * @param contentType - The content type of the request
	 * @param metadata - The metadata of the request
	 */
	constructor(
		trigger: TriggerType,
		stream: ReadableStream<ReadableDataType> | AsyncIterable<ReadableDataType>,
		contentType: string,
		metadata: JsonObject
	) {
		this._trigger = trigger;
		this._datahandler = new DataHandler(stream, contentType);
		this._metadata = metadata;
	}

	/**
	 * get the trigger of the request
	 */
	get trigger(): TriggerType {
		return this._trigger;
	}

	/**
	 * get the data of the request
	 */
	get data(): DataHandler {
		return this._datahandler;
	}

	/**
	 * get the metadata object of the request
	 */
	get metadata(): JsonObject {
		return this._metadata;
	}

	/**
	 * get the metadata value of the request
	 */
	get(key: string, defaultValue?: Json) {
		const metadata = this._metadata;
		if (key in metadata) {
			return metadata[key];
		}
		return defaultValue ?? null;
	}
}
