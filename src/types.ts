import type { Tracer } from '@opentelemetry/api';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Logger } from './logger';
import type { ServerAgent } from './server/types';

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

export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = Json[];
export type JsonObject = { [key: string]: Json };
export type JsonComposite = JsonArray | JsonObject;
export type Json = JsonPrimitive | JsonComposite;

interface NoContent {
	payload?: null | undefined;
	metadata?: Record<string, Json>;
}

interface JSONContent {
	contentType: 'application/json';
	payload: Json;
	metadata?: Record<string, Json>;
}

interface TextContent {
	contentType: 'text/plain';
	payload: string;
	metadata?: Record<string, Json>;
}

interface MarkdownContent {
	contentType: 'text/markdown';
	payload: string;
	metadata?: Record<string, Json>;
}

interface HTMLContent {
	contentType: 'text/html';
	payload: string;
	metadata?: Record<string, Json>;
}

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

interface AgentNoContentResponse extends NoContent {}

interface AgentJSONResponse extends JSONContent {}

interface AgentTextResponse extends TextContent {}

interface AgentMarkdownResponse extends MarkdownContent {}

interface AgentHTMLResponse extends HTMLContent {}

interface AgentBinaryResponse extends BinaryContent {}

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
	 * the unique id of the vector object
	 */
	id: string;
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
	agents: ServerAgent[];

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
	 * get the trigger of the request
	 */
	get trigger(): string;

	/**
	 * get the metadata of the request
	 */
	metadata(key: string, defaultValue?: Json): Json;

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

export interface IOSchema {
	source?: {
		sms?: StandardSchemaV1;
		voice?: StandardSchemaV1;
		email?: StandardSchemaV1;
		webhook?: StandardSchemaV1;
		queue?: StandardSchemaV1;
		agent?: StandardSchemaV1;
		manual?: StandardSchemaV1;
		cron?: StandardSchemaV1;
	};
	destination?: {
		sms?: StandardSchemaV1;
		voice?: StandardSchemaV1;
		email?: StandardSchemaV1;
		webhook?: StandardSchemaV1;
		queue?: StandardSchemaV1;
		agent?: StandardSchemaV1;
	};
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
	 * the name of the agent
	 */
	name: string;
	/**
	 * the description of the agent
	 */
	description?: string;
}

export interface Session {
	request: AgentRequestType;
	context: AgentContext;
}
