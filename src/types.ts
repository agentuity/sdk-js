import type { Tracer } from '@opentelemetry/api';
import type { Logger } from './logger';
import type { ReadableStream } from 'node:stream/web';

/**
 * Types of triggers that can initiate an agent request
 */
export type TriggerType =
	| 'webhook'
	| 'cron'
	| 'manual'
	| 'agent'
	| 'sms'
	| 'queue'
	| 'voice'
	| 'email'
	| 'agent';

/**
 * Data is a generic container for data and provides easy access to the data in different formats. Internally
 * the data is stored as a base64 encoded string so that it can be easily converted to different formats
 * (both textual and binary).
 */
export interface Data {
	/**
	 * the content type of the data such as 'text/plain', 'application/json', 'image/png', etc. if no content type is provided, it will be inferred from the data.
	 * if it cannot be inferred, it will be 'application/octet-stream'.
	 */
	contentType: string;

	/**
	 * an base64 encoded string of the data
	 */
	base64: string;

	/**
	 * the data represented as a string
	 */
	text: string;

	/**
	 * the JSON data. If the data is not JSON, this will throw an error.
	 */
	json: Json;

	/**
	 * get the data as an object of the given type T. If the data is not JSON, this will throw an error.
	 */
	object<T>(): T;

	/**
	 * the binary data represented as a Uint8Array<ArrayBuffer>
	 */
	binary: Uint8Array;

	/**
	 * the binary data represented as a Buffer
	 */
	buffer: Buffer;

	/**
	 * the stream of the data
	 */
	stream: ReadableStream<ReadableDataType>;
}

export type ReadableDataType =
	| Buffer
	| Uint8Array
	| ArrayBuffer
	| string
	| Blob;

/**
 * The type of data that can be passed to an agent as a payload
 */
export type DataType =
	| Buffer
	| Uint8Array
	| ArrayBuffer
	| string
	| Json
	| Blob
	| ReadableStream
	| Data;

/**
 * Primitive JSON value types
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * JSON array type
 */
export type JsonArray = Json[];

/**
 * JSON object type
 */
export type JsonObject = { [key: string]: Json };

/**
 * Composite JSON type (array or object)
 */
export type JsonComposite = JsonArray | JsonObject;

/**
 * Any valid JSON value
 */
export type Json = JsonPrimitive | JsonComposite;

/**
 * the result of a data operation when the data is found
 */
export interface DataResultFound {
	/**
	 * the data from the result of the operation
	 */
	data: Data;

	/**
	 * the data was found
	 */
	exists: true;
}

/**
 * the result of a data operation when the data is not found
 */
export interface DataResultNotFound {
	data: never;
	/**
	 * the data was not found
	 */
	exists: false;
}

/**
 * the result of a data operation
 */
export type DataResult = DataResultFound | DataResultNotFound;

export interface KeyValueStorageSetParams {
	ttl?: number;
	contentType?: string;
}

export interface KeyValueStorage {
	/**
	 * get a value from the key value storage
	 *
	 * @param name - the name of the key value storage
	 * @param key - the key to get the value of
	 * @returns the DataResult object
	 */
	get(name: string, key: string): Promise<DataResult>;

	/**
	 * set a value in the key value storage
	 *
	 * @param name - the name of the key value storage
	 * @param key - the key to set the value of
	 * @param value - the value to set in any of the supported data types
	 * @param params - the KeyValueStorageSetParams
	 */
	set(
		name: string,
		key: string,
		value: DataType,
		params?: KeyValueStorageSetParams
	): Promise<void>;

	/**
	 * delete a value from the key value storage
	 *
	 * @param name - the name of the key value storage
	 * @param key - the key to delete
	 */
	delete(name: string, key: string): Promise<void>;
}

type VectorUpsertEmbeddings = {
	/**
	 * the embeddings to upsert
	 */
	embeddings: Array<number>;
};

type VectorUpsertText = {
	/**
	 * the text to use for the embedding
	 */
	document: string;
};

type VectorUpsertBase = {
	/**
	 * the metadata to upsert
	 */
	metadata?: JsonObject;

	/**
	 * the key of the vector object which can be used as a reference. the value of this key is opaque to the vector storage.
	 */
	key: string;
};

export type VectorUpsertParams = VectorUpsertBase &
	(VectorUpsertEmbeddings | VectorUpsertText);

export interface VectorSearchParams {
	/**
	 * the query to search for
	 */
	query: string;
	/**
	 * the limit of the number of results to return
	 */
	limit?: number;
	/**
	 * the similarity of the results to return from 0.0-1.0. The higher the number, the more similar the results will be.
	 */
	similarity?: number;
	/**
	 * the metadata to filter the results by
	 */
	metadata?: JsonObject;
}

/**
 * the result of a vector search
 */
export interface VectorSearchResult {
	/**
	 * the unique id of the object in vector storage
	 */
	id: string;
	/**
	 * the key used when the vector object was added to vector storage
	 */
	key: string;
	/**
	 * the metadata of the vector object when it was stored
	 */
	metadata?: JsonObject;
	/**
	 * the distance of the vector object from the query from 0.0-1.0.
	 */
	distance: number;
}

/**
 * VectorStorage provides a way to store and search for data using vector embeddings
 */
export interface VectorStorage {
	/**
	 * upsert a vector into the vector storage
	 *
	 * @param name - the name of the vector storage
	 * @param documents - the documents for the vector upsert
	 * @returns the ids of the vectors that were upserted
	 */
	upsert(name: string, ...documents: VectorUpsertParams[]): Promise<string[]>;

	/**
	 * get a vector from the vector storage by key
	 *
	 * @param name - the name of the vector storage
	 * @param key - the key of the vector to get
	 * @returns the results of the vector search
	 */
	get(name: string, key: string): Promise<VectorSearchResult[]>;

	/**
	 * search for vectors in the vector storage
	 *
	 * @param name - the name of the vector storage
	 * @param params - the parameters for the vector search
	 * @returns the results of the vector search
	 */
	search(
		name: string,
		params: VectorSearchParams
	): Promise<VectorSearchResult[]>;

	/**
	 * delete a vector from the vector storage
	 *
	 * @param name - the name of the vector storage
	 * @param ids - the ids of the vectors to delete
	 * @returns the number of vector objects that were deleted
	 */
	delete(name: string, ...ids: string[]): Promise<number>;
}

export interface InvocationArguments {
	data?: DataType;
	contentType?: string;
	metadata?: JsonObject;
}

export interface RemoteAgentResponse {
	data: Data;
	contentType: string;
	metadata?: JsonObject;
}

export interface RemoteAgent {
	/**
	 * the unique id for the agent
	 */
	id: string;

	/**
	 * the name of the agent
	 */
	name: string;

	/**
	 * the description of the agent
	 */
	description?: string;

	/**
	 * the project id of the agent
	 */
	projectId: string;

	/**
	 * run the agent with data and get a response
	 *
	 * @param args - the arguments to pass to the agent
	 * @returns the response from the agent
	 */
	run(args: InvocationArguments): Promise<RemoteAgentResponse>;
}

interface GetAgentRequestParamsById {
	/**
	 * the unique agent id
	 */
	id: string;
}

interface GetAgentRequestParamsByName {
	/**
	 * the agent name in the project
	 */
	name: string;
	/**
	 * the project id
	 */
	projectId?: string;
}

export type GetAgentRequestParams =
	| GetAgentRequestParamsById
	| GetAgentRequestParamsByName;

export interface AgentContext {
	/**
	 * the version of the Agentuity SDK
	 */
	sdkVersion: string;

	/**
	 * returns true if the agent is running in devmode
	 */
	devmode: boolean;

	/**
	 * the run id
	 */
	runId: string;

	/**
	 * the org id
	 */
	orgId: string;

	/**
	 * the deployment id
	 */
	deploymentId: string;

	/**
	 * the project id
	 */
	projectId: string;

	/**
	 * the agent configuration
	 */
	agent: AgentConfig;

	/**
	 * the logger
	 */
	logger: Logger;

	/**
	 * the tracer
	 */
	tracer: Tracer;

	/**
	 * return a list of all the agents in the project
	 */
	agents: AgentConfig[];

	/**
	 * get a handle to a remote agent that you can invoke
	 */
	getAgent(params: GetAgentRequestParams): Promise<RemoteAgent>;

	/**
	 * the key value storage
	 */
	kv: KeyValueStorage;

	/**
	 * the vector storage
	 */
	vector: VectorStorage;
}

/**
 * The request that triggered the agent invocation
 */
export interface AgentRequest {
	/**
	 * get the trigger of the request
	 */
	get trigger(): TriggerType;

	/**
	 * get the data of the request
	 */
	get data(): Data;

	/**
	 * get the metadata object of the request
	 */
	get metadata(): JsonObject;

	/**
	 * get the metadata value of the request
	 */
	get(key: string, defaultValue?: Json): Json;
}

export interface AgentResponseData {
	data: Data;
	metadata?: JsonObject;
}

export interface AgentRedirectResponse {
	redirect: true;
	agent: GetAgentRequestParams;
	invocation?: InvocationArguments;
}

/**
 * The response from an agent invocation. This is a convenience object that can be used to return a response from an agent.
 */
export interface AgentResponse {
	/**
	 * handoff the current request another agent within the same project
	 *
	 * @param agent - the agent to handoff the request to
	 * @param args - the arguments to pass to the agent. if undefined, will pass the current request data
	 * @returns the response from the agent
	 */
	handoff(
		agent: GetAgentRequestParams,
		args?: InvocationArguments
	): Promise<AgentRedirectResponse>;

	/**
	 * return an empty response with optional metadata
	 */
	empty(metadata?: JsonObject): Promise<AgentResponseData>;

	/**
	 * return a JSON response with optional metadata
	 */
	json(data: Json, metadata?: JsonObject): Promise<AgentResponseData>;

	/**
	 * return a text response with optional metadata
	 */
	text(data: string, metadata?: JsonObject): Promise<AgentResponseData>;

	/**
	 * return a binary response with optional metadata
	 */
	binary(data: DataType, metadata?: JsonObject): Promise<AgentResponseData>;

	/**
	 * return a PDF response with optional metadata
	 */
	pdf(data: DataType, metadata?: JsonObject): Promise<AgentResponseData>;

	/**
	 * return a PNG response with optional metadata
	 */
	png(data: DataType, metadata?: JsonObject): Promise<AgentResponseData>;

	/**
	 * return a JPEG response with optional metadata
	 */
	jpeg(data: DataType, metadata?: JsonObject): Promise<AgentResponseData>;

	/**
	 * return a GIF response with optional metadata
	 */
	gif(data: DataType, metadata?: JsonObject): Promise<AgentResponseData>;

	/**
	 * return a WebP response with optional metadata
	 */
	webp(data: DataType, metadata?: JsonObject): Promise<AgentResponseData>;

	/**
	 * return a MP3 response with optional metadata
	 */
	mp3(data: DataType, metadata?: JsonObject): Promise<AgentResponseData>;

	/**
	 * return a MP4 response with optional metadata
	 */
	mp4(data: DataType, metadata?: JsonObject): Promise<AgentResponseData>;

	/**
	 * return a M4A response with optional metadata
	 */
	m4a(data: DataType, metadata?: JsonObject): Promise<AgentResponseData>;

	/**
	 * return a M4P response with optional metadata
	 */
	m4p(data: DataType, metadata?: JsonObject): Promise<AgentResponseData>;

	/**
	 * return a WebM response with optional metadata
	 */
	webm(data: DataType, metadata?: JsonObject): Promise<AgentResponseData>;

	/**
	 * return a HTML response with optional metadata
	 */
	html(data: string, metadata?: JsonObject): Promise<AgentResponseData>;

	/**
	 * return a WAV response with optional metadata
	 */
	wav(data: DataType, metadata?: JsonObject): Promise<AgentResponseData>;

	/**
	 * return an OGG response with optional metadata
	 */
	ogg(data: DataType, metadata?: JsonObject): Promise<AgentResponseData>;

	/**
	 * stream a response to the client
	 */
	stream(
		stream: ReadableStream,
		contentType: string,
		metadata?: JsonObject
	): Promise<AgentResponseData>;
}

/**
 * the handler for the agent
 */
export type AgentHandler = (
	request: AgentRequest,
	response: AgentResponse,
	context: AgentContext
) => Promise<AgentResponseData>;

/**
 * the config for the agent
 */
export interface AgentConfig {
	/**
	 * the unique id of the agent
	 */
	id: string;
	/**
	 * the name of the agent
	 */
	name: string;
	/**
	 * the description of the agent
	 */
	description?: string;
	/**
	 * the file name to the agent relative to the dist directory
	 */
	filename: string;
}

/**
 * Session information for an agent request
 */
export interface Session {
	request: AgentRequest;
	context: AgentContext;
}

export interface DataPayload {
	trigger: TriggerType;
	contentType: string;
	payload?: string;
	metadata?: JsonObject;
}
