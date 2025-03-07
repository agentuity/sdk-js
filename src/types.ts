import type { Tracer } from '@opentelemetry/api';
import type { Logger } from './logger';

/**
 * Types of triggers that can initiate an agent
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
 * Content with no payload
 */
interface NoContent {
	payload?: null | undefined;
	metadata?: Record<string, Json>;
}

/**
 * JSON content
 */
interface JSONContent {
	contentType: 'application/json';
	payload: Json;
	metadata?: Record<string, Json>;
}

/**
 * Plain text content
 */
interface TextContent {
	contentType: 'text/plain';
	payload: string;
	metadata?: Record<string, Json>;
}

/**
 * Markdown content
 */
interface MarkdownContent {
	contentType: 'text/markdown';
	payload: string;
	metadata?: Record<string, Json>;
}

/**
 * HTML content
 */
interface HTMLContent {
	contentType: 'text/html';
	payload: string;
	metadata?: Record<string, Json>;
}

/**
 * Binary content with various media types
 */
interface BinaryContent {
	contentType:
		| 'application/octet-stream'
		| 'application/pdf'
		| 'image/png'
		| 'image/jpeg'
		| 'image/gif'
		| 'image/webp'
		| 'audio/mpeg'
		| 'audio/mp3'
		| 'audio/wav'
		| 'audio/ogg'
		| 'audio/m4a'
		| 'audio/aac'
		| 'audio/mp4'
		| 'audio/m4p'
		| 'audio/webm';
	payload: ArrayBuffer;
	metadata?: Record<string, Json>;
}

/**
 * Agent request type
 */
export interface AgentRequestType {
	trigger: string;
	contentType: string;
	metadata?: Record<string, Json>;
	payload?: Json | ArrayBuffer | string;
}

/**
 * Agent response with no content
 */
interface AgentNoContentResponse extends NoContent {}

/**
 * Agent response with JSON content
 */
interface AgentJSONResponse extends JSONContent {}

/**
 * Agent response with text content
 */
interface AgentTextResponse extends TextContent {}

/**
 * Agent response with markdown content
 */
interface AgentMarkdownResponse extends MarkdownContent {}

/**
 * Agent response with HTML content
 */
interface AgentHTMLResponse extends HTMLContent {}

/**
 * Agent response with binary content
 */
interface AgentBinaryResponse extends BinaryContent {}

/**
 * Agent response that triggers another agent
 */
interface AgentAgentResponse {
	trigger: 'agent';
	agentId: string;
	payload?: Json | ArrayBuffer | string;
	metadata?: Record<string, Json>;
}
export interface AgentRedirectResponse extends AgentAgentResponse {
	redirect: true;
	agent: GetAgentRequestParams;
	payload?: Json | ArrayBuffer | string;
	contentType?: string;
	metadata?: Record<string, Json>;
}

export type AgentResponseType =
	| AgentNoContentResponse
	| AgentJSONResponse
	| AgentTextResponse
	| AgentMarkdownResponse
	| AgentHTMLResponse
	| AgentBinaryResponse
	| AgentRedirectResponse
	| AgentAgentResponse;

export interface KeyValueStorage {
	/**
	 * get a value from the key value storage
	 *
	 * @param name - the name of the key value storage
	 * @param key - the key to get the value of
	 * @returns the value of the key
	 */
	get(name: string, key: string): Promise<ArrayBuffer | null>;

	/**
	 * set a value in the key value storage
	 *
	 * @param name - the name of the key value storage
	 * @param key - the key to set the value of
	 * @param value - the value to set
	 * @param ttl - the time to live of the key
	 */
	set(
		name: string,
		key: string,
		value: ArrayBuffer | string | Json,
		ttl?: number
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
	metadata?: Json;

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
	metadata?: Json;
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
	metadata?: Json;
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
	 * invoke the agent with data and get a response
	 *
	 * @param data - the payload for the request
	 * @param contentType - the content type of the payload (if not provided, the agent will try to infer it)
	 * @param metadata - the metadata for the request
	 * @returns the response from the agent
	 */
	run(
		data?: Json | ArrayBuffer | string,
		contentType?: string,
		metadata?: Record<string, Json>
	): Promise<AgentResponseType>;
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

export interface AgentRequest {
	/**
	 * returns the content type for the request
	 */
	get contentType(): string;

	/**
	 * get the trigger of the request
	 */
	get trigger(): string;

	/**
	 * get the metadata object of the request
	 */
	get metadata(): Json;

	/**
	 * get the metadata value of the request
	 */
	get(key: string, defaultValue?: Json): Json;

	/**
	 * get the payload of the request as an object of the given type
	 */
	object<T>(): T;

	/**
	 * get the payload of the request as a JSON object
	 */
	json(): Json;

	/**
	 * get the payload of the request as a string
	 */
	text(): string;

	/**
	 * get the payload of the request as an ArrayBuffer
	 */
	binary(): ArrayBuffer;

	/**
	 * get the payload of the request as a PDF
	 */
	pdf(): ArrayBuffer;

	/**
	 * get the payload of the request as a PNG
	 */
	png(): ArrayBuffer;

	/**
	 * get the payload of the request as a JPEG
	 */
	jpeg(): ArrayBuffer;

	/**
	 * get the payload of the request as a GIF
	 */
	gif(): ArrayBuffer;

	/**
	 * get the payload of the request as a WebP
	 */
	webp(): ArrayBuffer;

	/**
	 * get the payload of the request as a MP3
	 */
	mp3(): ArrayBuffer;

	/**
	 * get the payload of the request as a M4A
	 */
	m4a(): ArrayBuffer;

	/**
	 * get the payload of the request as a M4P
	 */
	m4p(): ArrayBuffer;

	/**
	 * get the payload of the request as a WebM
	 */
	webm(): ArrayBuffer;

	/**
	 * get the payload of the request as a WAV
	 */
	wav(): ArrayBuffer;

	/**
	 * get the payload of the request as an OGG
	 */
	ogg(): ArrayBuffer;
}

export interface AgentResponse {
	/**
	 * redirect the current request another agent within the same project
	 */
	redirect(
		agent: GetAgentRequestParams,
		payload?: Json | ArrayBuffer | string,
		contentType?: string,
		metadata?: Record<string, Json>
	): AgentRedirectResponse;

	/**
	 * return an empty response with optional metadata
	 */
	empty(metadata?: Record<string, Json>): AgentResponseType;

	/**
	 * return a JSON response with optional metadata
	 */
	json(data: Json, metadata?: Record<string, Json>): AgentResponseType;

	/**
	 * return a text response with optional metadata
	 */
	text(data: string, metadata?: Record<string, Json>): AgentResponseType;

	/**
	 * return a binary response with optional metadata
	 */
	binary(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType;

	/**
	 * return a PDF response with optional metadata
	 */
	pdf(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType;

	/**
	 * return a PNG response with optional metadata
	 */
	png(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType;

	/**
	 * return a JPEG response with optional metadata
	 */
	jpeg(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType;

	/**
	 * return a GIF response with optional metadata
	 */
	gif(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType;

	/**
	 * return a WebP response with optional metadata
	 */
	webp(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType;

	/**
	 * return a MP3 response with optional metadata
	 */
	mp3(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType;

	/**
	 * return a MP4 response with optional metadata
	 */
	mp4(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType;

	/**
	 * return a M4A response with optional metadata
	 */
	m4a(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType;

	/**
	 * return a M4P response with optional metadata
	 */
	m4p(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType;

	/**
	 * return a WebM response with optional metadata
	 */
	webm(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType;

	/**
	 * return a HTML response with optional metadata
	 */
	html(data: string, metadata?: Record<string, Json>): AgentResponseType;

	/**
	 * return a WAV response with optional metadata
	 */
	wav(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType;

	/**
	 * return an OGG response with optional metadata
	 */
	ogg(data: ArrayBuffer, metadata?: Record<string, Json>): AgentResponseType;
}

/**
 * the handler for the agent
 */
export type AgentHandler = (
	request: AgentRequest,
	response: AgentResponse,
	context: AgentContext
) => Promise<AgentResponseType>;

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
	request: AgentRequestType;
	context: AgentContext;
}
