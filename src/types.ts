import type { ReadableStream, WritableStream } from 'node:stream/web';
import type { Meter, Tracer } from '@opentelemetry/api';
import type { DiscordMessage } from './io/discord';
import type { Email } from './io/email';
import type {
	Slack,
	SlackAttachmentsMessage,
	SlackBlocksMessage,
	SlackReplyOptions,
} from './io/slack';
import type { Sms } from './io/sms';
import type { Teams, TeamsCustomBot } from './io/teams';
import type { AgentuityTeamsActivityHandlerConstructor } from './io/teams/AgentuityTeamsActivityHandler';
import type { Telegram } from './io/telegram';
import type { Logger } from './logger';

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
	| 'discord'
	| 'telegram'
	| 'slack'
	| 'teams';

/**
 * The scope of the agent invocation
 */
export type AgentInvocationScope = 'local' | 'remote';

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
	base64(): Promise<string>;

	/**
	 * the data represented as a string
	 */
	text(): Promise<string>;

	/**
	 * the JSON data. If the data is not JSON, this will throw an error.
	 */
	json(): Promise<Json>;

	/**
	 * get the data as an object of the given type T. If the data is not JSON, this will throw an error.
	 */
	object<T>(): Promise<T>;

	/**
	 * the binary data represented as a Uint8Array<ArrayBuffer>
	 */
	binary(): Promise<Uint8Array>;

	/**
	 * the binary data represented as a Buffer
	 */
	buffer(): Promise<Buffer>;

	/**
	 * the stream of the data
	 */
	stream(): Promise<ReadableStream<ReadableDataType>>;

	/**
	 * the email data represented as a Email. If the data is not an email in rfc822 format, this will throw an error.
	 */
	email(): Promise<Email>;

	/**
	 * the discord message data represented as a DiscordMessage. If the data is not a valid discord message, this will throw an error.
	 */
	discord(): Promise<DiscordMessage>;

	/**
	 * the sms data represented as a Sms. If the data is not a valid sms, this will throw an error.
	 */
	sms(): Promise<Sms>;

	/**
	 * the telegram message data represented as a TelegramMessage. If the data is not a valid telegram message, this will throw an error.
	 */
	telegram(): Promise<Telegram>;

	/**
	 * the slack message data represented as a Slack. If the data is not a valid slack message, this will throw an error.
	 */
	slack(): Promise<Slack>;

	/**
	 * the teams message data represented as a Teams. If the data is not a valid teams message, this will throw an error.
	 */
	teams(): Promise<Teams>;
	teams(
		botClass: AgentuityTeamsActivityHandlerConstructor
	): Promise<TeamsCustomBot>;
	teams(
		botClass?: AgentuityTeamsActivityHandlerConstructor
	): Promise<Teams | TeamsCustomBot>;
}

/**
 * check if a value is a Data object
 */
export function isDataObject(value: unknown): value is Data {
	if (value && typeof value === 'object' && 'contentType' in value) {
		return true;
	}
	return false;
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
 * check if a value is a ReadableStream
 */
export function isReadableStream(value: unknown): value is ReadableStream {
	if (typeof value === 'object' && value !== null) {
		return 'getReader' in value;
	}
	return false;
}

/**
 * check if a value is a valid DataType
 */
export function isDataType(value: unknown): value is DataType {
	if (value === null || value === undefined) {
		return false;
	}
	if (typeof value === 'string') {
		return true;
	}
	if (isDataObject(value)) {
		return true;
	}
	if (typeof value === 'object') {
		if (
			value instanceof Buffer ||
			value instanceof Uint8Array ||
			value instanceof ArrayBuffer ||
			value instanceof Blob
		) {
			return true;
		}
		if (isReadableStream(value)) {
			return true;
		}
	}
	return isJsonObject(value);
}

/**
 * Primitive JSON value types
 */
export type JsonPrimitive =
	| string
	| number
	| boolean
	| null
	| JsonArray
	| JsonObject;

/**
 * JSON array type
 */
export interface JsonArray extends Array<JsonPrimitive> {}

/**
 * valid keys for a JSON object
 */
export type JsonKey = string | number;

/**
 * JSON object type
 */
export type JsonObject = {
	[key in JsonKey]: JsonPrimitive;
};

/**
 * Composite JSON type (array or object)
 */
export type JsonComposite = JsonArray | JsonObject;

/**
 * Any valid JSON value
 */
export type Json = JsonPrimitive | JsonComposite;

// Runtime type guard to check if unknown is a JsonObject
export function isJsonObject(value: unknown): value is JsonObject {
	if (value === null || value === undefined) {
		return true; // these will be filtered out so they are ok
	}
	// validate all array elements are json objects
	if (Array.isArray(value)) {
		return value.every(isJsonObject);
	}
	// if primitive types, they are ok
	if (
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	) {
		return true;
	}
	// validate all object values are json objects
	if (typeof value === 'object') {
		return Object.keys(value).every((key) =>
			isJsonObject(value[key as keyof typeof value])
		);
	}
	return false;
}

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
	/**
	 * the number of milliseconds to keep the value in the cache
	 */
	ttl?: number;
	/**
	 * the content type of the value
	 */
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
	set<T = unknown>(
		name: string,
		key: string,
		value: T,
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

/**
 * Properties for creating a stream
 */
export interface CreateStreamProps {
	/**
	 * optional metadata for the stream
	 */
	metadata?: Record<string, string>;

	/**
	 * optional contentType for the stream data. If not set, defaults to application/octet-stream
	 */
	contentType?: string;
}

/**
 * A durable and resumable stream that can be written to and read many times.
 * The underlying stream is backed by a durable storage system and the URL
 * returned is public and guaranteed to return the same data every time it is accessed.
 * You can read from this stream internal in the agent using the getReader() method or
 * return the URL to the stream to be used externally.
 *
 * You must write and close the stream before it can be read but if you attempt to read
 * before any data is written, the reader will block until the first write occurs.
 */
export interface Stream extends WritableStream {
	/**
	 * unique stream identifier
	 */
	id: string;
	/**
	 * the unique stream url to consume the stream
	 */
	url: string;
	/**
	 * close the stream gracefully, handling already closed streams without error
	 */
	close(): Promise<void>;
	/**
	 * get a ReadableStream that streams from the internal URL
	 *
	 * Note: This method will block waiting for data until writes start to the Stream.
	 * The returned ReadableStream will remain open until the Stream is closed or an error occurs.
	 *
	 * @returns a ReadableStream that can be passed to response.stream()
	 */
	getReader(): ReadableStream<Uint8Array>;
}

/**
 * Stream API for creating and managing streams
 */
export interface StreamAPI {
	/**
	 * create a new stream
	 *
	 * @param name - the name of the stream (1-254 characters). you can group streams by name to organize them.
	 * @param props - optional properties for creating the stream
	 * @returns a Promise that resolves to the created Stream
	 */
	create(name: string, props?: CreateStreamProps): Promise<Stream>;
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

export interface VectorSearchParams<T = unknown> {
	/**
	 * The text query to search for in the vector storage. This will be converted to embeddings
	 * and used to find semantically similar documents.
	 *
	 * @example "comfortable office chair"
	 * @example "machine learning algorithms"
	 */
	query: string;

	/**
	 * Maximum number of search results to return. If not specified, the server default will be used.
	 * Must be a positive integer.
	 *
	 * @default Default is 10
	 * @example 5
	 * @example 20
	 */
	limit?: number;

	/**
	 * Minimum similarity threshold for results. Only vectors with similarity scores greater than or equal
	 * to this value will be returned. Value must be between 0.0 and 1.0, where 1.0 means exact match
	 * and 0.0 means no similarity requirement.
	 *
	 * @minimum 0.0
	 * @maximum 1.0
	 * @example 0.7 // Only return results with 70% or higher similarity
	 * @example 0.5 // Return results with 50% or higher similarity
	 */
	similarity?: number;

	/**
-export interface VectorSearchParams<T = unknown> {
+export interface VectorSearchParams<T extends JsonObject = JsonObject> {
	/**
	 * Metadata filters to apply to the search. Only vectors whose metadata matches all specified
	 * key-value pairs will be included in results. Must be a valid JSON object if provided.
	 *
	 * @example { category: "furniture", inStock: true }
	 * @example { userId: "123", type: "product" }
	 */
	metadata?: T;
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
	 * the distance of the vector object from the query from 0-1. The larger the number, the more similar the vector object is to the query.
	 */
	similarity: number;
}

export interface VectorSearchResultWithDocument extends VectorSearchResult {
	/**
	 * the document that was used to create the vector object
	 */
	document?: string;
	/**
	 * the embeddings of the vector object
	 */
	embeddings?: Array<number>;
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
	get(
		name: string,
		key: string
	): Promise<VectorSearchResultWithDocument | null>;

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
	 * delete vectors from the vector storage
	 *
	 * @param name - the name of the vector storage
	 * @param keys - the keys of the vectors to delete
	 * @returns the number of vector objects that were deleted
	 */
	delete(name: string, ...keys: string[]): Promise<number>;
}

/**
 * EmailService provides a way to send email replies to incoming emails
 */
export interface EmailService {
	/**
	 * send an email reply to an incoming email
	 *
	 * @param agentId - the id of the agent to send the reply to
	 * @param email - the email to send the reply to in RFC822 format
	 * @param authToken - the authorization token to use to send the reply
	 * @param messageId - the message id of the email
	 * @param from - the email address to send the reply from (NOTE: you can only override the email address if you have configured custom email sending)
	 */
	sendReply(
		agentId: string,
		email: string,
		authToken: string,
		messageId: string,
		from?: {
			name?: string;
			email?: string;
		}
	): Promise<void>;
}

/**
 * DiscordService provides a way to send a discord message replying to a incoming Discord message
 */
export interface DiscordService {
	/**
	 * send a reply to a incoming Discord message
	 *
	 * @param agentId - the id of the agent to send the reply to
	 * @param messageId - the message id of the discord message
	 * @param channelId - the channel id of the discord message
	 * @param content - the content of the reply
	 */
	sendReply(
		agentId: string,
		messageId: string,
		channelId: string,
		content: string
	): Promise<void>;
}

export interface SMSService {
	/**
	 * send an SMS to a phone number
	 */
	sendReply(
		agentId: string,
		phoneNumber: string,
		authToken: string,
		messageId: string
	): Promise<void>;
}

export interface TelegramService {
	/**
	 * send a reply to a incoming Telegram message
	 */
	sendReply(
		req: AgentRequest,
		ctx: AgentContext,
		reply: string,
		options: { parseMode?: 'MarkdownV2' | 'HTML' }
	): Promise<void>;

	/**
	 * send a typing indicator to a incoming Telegram message
	 * expires after 5 seconds or when a message is sent
	 */
	sendTyping(req: AgentRequest, ctx: AgentContext): Promise<void>;
}

export interface SlackService {
	/**
	 * send a reply to a incoming Slack message or event
	 */
	sendReply(
		req: AgentRequest,
		ctx: AgentContext,
		reply: string | SlackBlocksMessage | SlackAttachmentsMessage,
		options?: SlackReplyOptions
	): Promise<void>;
}

export interface ObjectStorePutParams {
	/**
	 * the content type of the object
	 */
	contentType?: string;

	/**
	 * the content encoding of the object
	 */
	contentEncoding?: string;

	/**
	 * the cache control header for the object
	 */
	cacheControl?: string;

	/**
	 * the content disposition header for the object
	 */
	contentDisposition?: string;

	/**
	 * the content language header for the object
	 */
	contentLanguage?: string;

	/**
	 * arbitrary metadata to attach to the object but not returned as part of the object when fetched via HTTP
	 */
	metadata?: Record<string, string>;
}

export interface ObjectStore {
	/**
	 * get an object from the object store
	 *
	 * @param bucket - the bucket to get the object from
	 * @param key - the key of the object to get
	 * @returns the data result from the object store
	 */
	get(bucket: string, key: string): Promise<DataResult>;

	/**
	 * put an object into the object store
	 */
	put(
		bucket: string,
		key: string,
		data: DataType,
		params?: ObjectStorePutParams
	): Promise<void>;

	/**
	 * delete an object from the object store
	 *
	 * @param bucket - the bucket to delete the object from
	 * @param key - the key of the object to delete
	 * @returns true if the object was deleted, false if the object did not exist
	 */
	delete(bucket: string, key: string): Promise<boolean>;

	/**
	 * create a public URL for an object. This URL can be used to access the object without authentication.
	 *
	 * @param bucket - the bucket to create the signed URL for
	 * @param key - the key of the object to create the signed URL for
	 * @param expiresDuration - the duration of the signed URL in milliseconds. If not provided, the default is 1 hour.
	 * @returns the public URL
	 */
	createPublicURL(
		bucket: string,
		key: string,
		expiresDuration?: number
	): Promise<string>;
}

export interface InvocationArguments<T = unknown> {
	/**
	 * the data to pass to the agent
	 */
	data?: DataType;
	/**
	 * the content type of the data
	 */
	contentType?: string;
	/**
	 * the metadata to pass to the agent
	 */
	metadata?: T;
}

export interface RemoteAgentResponse {
	/**
	 * the response data from the agent
	 */
	data: Data;
	/**
	 * the metadata from the agent
	 */
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
	 * the project id of the agent
	 */
	projectId: string;

	/**
	 * run the agent with data and get a response
	 *
	 * @param args - the arguments to pass to the agent
	 * @returns the response from the agent
	 */
	run<T = unknown>(args: InvocationArguments<T>): Promise<RemoteAgentResponse>;
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

/**
 * The signature for the waitUntil method
 */
export type WaitUntilCallback = (
	promise: Promise<void> | (() => void | Promise<void>)
) => void;

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
	 * the session id
	 */
	sessionId: string;

	/**
	 * the run id
	 * @deprecated Use sessionId instead
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
	 * scope of the agent invocation
	 */
	scope: AgentInvocationScope;

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
	 * the meter
	 */
	meter: Meter;

	/**
	 * return a list of all the agents in the project
	 */
	agents: AgentConfig[];

	/**
	 * get a handle to a remote agent that you can invoke
	 */
	getAgent(params: GetAgentRequestParams): Promise<RemoteAgent>;

	/**
	 * extends the lifetime of the request handler for the lifetime of the passed in Promise.
	 * The waitUntil() method enqueues an asynchronous task to be performed during the lifecycle of the request.
	 * You can use it for anything that can be done after the response is sent without blocking the response.
	 */
	waitUntil: WaitUntilCallback;

	/**
	 * the key value storage
	 */
	kv: KeyValueStorage;

	/**
	 * the vector storage
	 */
	vector: VectorStorage;

	/**
	 * the stream api
	 */
	stream: StreamAPI;

	/**
	 * the email service
	 */
	email: EmailService;

	/**
	 * the discord service
	 */
	discord: DiscordService;

	/**
	 * the object store
	 */
	objectstore: ObjectStore;

	/**
	 * the slack service
	 */
	slack: SlackService;

	/**
	 * the prompts API
	 */
	prompts: {
		compile: <
			T extends
				keyof import('./apis/prompt/generated/index.js').PromptsCollection,
		>(
			name: T,
			variables?: {
				system?: Parameters<
					import('./apis/prompt/generated/index.js').PromptsCollection[T]['system']
				>[0];
				prompt?: Parameters<
					import('./apis/prompt/generated/index.js').PromptsCollection[T]['prompt']
				>[0];
			}
		) => { system: string; prompt: string };
		getPrompt: <
			T extends
				keyof import('./apis/prompt/generated/index.js').PromptsCollection,
		>(
			name: T
		) => {
			system: import('./apis/prompt/generated/index.js').PromptsCollection[T]['system'];
			prompt: import('./apis/prompt/generated/index.js').PromptsCollection[T]['prompt'];
		};
	};
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
	/**
	 * the data from the agent
	 */
	data: Data;
	/**
	 * the metadata from the agent
	 */
	metadata?: JsonObject;
}

export interface AgentRedirectResponse {
	/**
	 * if this is a redirect response
	 */
	redirect: true;
	/**
	 * the agent to redirect to
	 */
	agent: GetAgentRequestParams;
	/**
	 * the invocation arguments
	 */
	invocation?: InvocationArguments<JsonObject>;
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
	handoff<M = unknown>(
		agent: GetAgentRequestParams,
		args?: InvocationArguments<M>
	): Promise<AgentRedirectResponse>;

	/**
	 * return an empty response with optional metadata
	 */
	empty<M = unknown>(metadata?: M): Promise<AgentResponseData>;

	/**
	 * return a JSON response with optional metadata
	 */
	json<T = unknown, M = unknown>(
		data: T,
		metadata?: M
	): Promise<AgentResponseData>;

	/**
	 * return a text response with optional metadata
	 */
	text<M = unknown>(data: string, metadata?: M): Promise<AgentResponseData>;

	/**
	 * return a binary response with optional metadata
	 */
	binary<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData>;

	/**
	 * return a PDF response with optional metadata
	 */
	pdf<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData>;

	/**
	 * return a PNG response with optional metadata
	 */
	png<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData>;

	/**
	 * return a JPEG response with optional metadata
	 */
	jpeg<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData>;

	/**
	 * return a GIF response with optional metadata
	 */
	gif<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData>;

	/**
	 * return a WebP response with optional metadata
	 */
	webp<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData>;

	/**
	 * return a MP3 response with optional metadata
	 */
	mp3<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData>;

	/**
	 * return a MP4 response with optional metadata
	 */
	mp4<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData>;

	/**
	 * return a M4A response with optional metadata
	 */
	m4a<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData>;

	/**
	 * return a M4P response with optional metadata
	 */
	m4p<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData>;

	/**
	 * return a WebM response with optional metadata
	 */
	webm<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData>;

	/**
	 * return a HTML response with optional metadata
	 */
	html<M = unknown>(data: string, metadata?: M): Promise<AgentResponseData>;

	/**
	 * return a WAV response with optional metadata
	 */
	wav<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData>;

	/**
	 * return an OGG response with optional metadata
	 */
	ogg<M = unknown>(data: DataType, metadata?: M): Promise<AgentResponseData>;

	/**
	 * return a response with specific data and content type with optional metadata
	 *
	 * @param data - the data to return
	 * @param contentType - the content type of the data
	 * @param metadata - the metadata to return
	 * @returns the response data
	 */
	data<M = unknown>(
		data: DataType,
		contentType: string,
		metadata?: M
	): Promise<AgentResponseData>;

	/**
	 * return a markdown response with optional metadata
	 */
	markdown<M = unknown>(
		content: string,
		metadata?: M
	): Promise<AgentResponseData>;

	/**
	 * stream a response to the client. the content type will default to application/octet-stream if not provided.
	 * For object types (non-ReadableDataType), automatically converts to JSON newline format and defaults content type to application/json.
	 *
	 * @param stream - the stream to return
	 * @param contentType - the content type of the stream
	 * @param metadata - the metadata to return as headers
	 * @param transformer - optional transformer function or generator function to transform/filter each item.
	 *                     Function: (item) => value | null | undefined - returns single value or skips
	 *                     Generator: function* (item) { yield value; } - yields single value (alternative syntax)
	 * @returns the response data
	 */
	stream<T = unknown, U = T, M = unknown>(
		stream: ReadableStream<T> | AsyncIterable<T>,
		contentType?: string,
		metadata?: M,
		transformer?:
			| ((item: T) => U | null | undefined)
			| ((item: T) => Generator<U, void, unknown>)
	): Promise<AgentResponseData>;
}

/**
 * the handler for the agent
 */
export type AgentHandler = (
	request: AgentRequest,
	response: AgentResponse,
	context: AgentContext
) => Promise<AgentResponseData | Response | Stream>;

export interface AgentWelcomePrompt {
	/**
	 * The data as a DataType
	 */
	data: DataType;
	/**
	 * The data format
	 */
	contentType: string;
}

export interface AgentWelcomeResult {
	/**
	 * The welcome prompt to display to the user
	 */
	welcome: string;
	/**
	 * The example prompts to display to the user
	 */
	prompts?: AgentWelcomePrompt[];
}

/**
 * The welcome function for the agent
 */
export type AgentWelcome = () =>
	| AgentWelcomeResult
	| Promise<AgentWelcomeResult>;

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
	/**
	 * the request
	 */
	request: AgentRequest;
	/**
	 * the context
	 */
	context: AgentContext;
}

export interface DataPayload {
	/**
	 * the trigger that caused the invocation
	 */
	trigger: TriggerType;
	/**
	 * the content type
	 */
	contentType: string;
	/**
	 * the metadata
	 */
	metadata?: JsonObject;
}
