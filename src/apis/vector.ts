import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { getTracer, recordException } from '../router/router';
import { safeStringify } from '../server/util';
import type {
	VectorSearchParams,
	VectorSearchResult,
	VectorStorage,
	VectorUpsertParams,
} from '../types';
import { isJsonObject } from '../types';
import { DELETE, GET, POST, PUT } from './api';

/**
 * Response for a successful vector upsert operation
 */
interface VectorUpsertSuccessResponse {
	success: true;
	ids: string[];
}

/**
 * Response for a failed vector upsert operation
 */
interface VectorUpsertErrorResponse {
	success: false;
	message: string;
}

/**
 * Response for a vector upsert operation
 */
type VectorUpsertResponse =
	| VectorUpsertSuccessResponse
	| VectorUpsertErrorResponse;

/**
 * Response for a successful vector search operation
 */
interface VectorSearchSuccessResponse {
	success: true;
	data: VectorSearchResult[];
}

/**
 * Response for a failed vector search operation
 */
interface VectorSearchErrorResponse {
	success: false;
	message: string;
}

/**
 * Response for a vector search operation
 */
type VectorSearchResponse =
	| VectorSearchSuccessResponse
	| VectorSearchErrorResponse;

/**
 * Response for a successful vector delete operation
 */
interface VectorDeleteSuccessResponse {
	success: true;
	data: number;
}

/**
 * Response for a failed vector delete operation
 */
interface VectorDeleteErrorResponse {
	success: false;
	message: string;
}

/**
 * Response for a vector delete operation
 */
type VectorDeleteResponse =
	| VectorDeleteSuccessResponse
	| VectorDeleteErrorResponse;

/**
 * Response for a successful vector delete operation
 */
interface VectorGetSuccessResponse {
	success: true;
	data: VectorSearchResult | null;
}

/**
 * Response for a failed vector delete operation
 */
interface VectorGetErrorResponse {
	success: false;
	message: string;
}

/**
 * Response for a vector get operation
 */
type VectorGetResponse = VectorGetSuccessResponse | VectorGetErrorResponse;

/**
 * Implementation of the VectorStorage interface for interacting with the vector storage API
 */
export default class VectorAPI implements VectorStorage {
	/**
	 * upsert a vector into the vector storage
	 *
	 * @param name - the name of the vector storage
	 * @param documents - the documents for the vector upsert
	 * @returns the ids of the vectors that were upserted
	 */
	async upsert(
		name: string,
		...documents: VectorUpsertParams[]
	): Promise<string[]> {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan(
			'agentuity.vector.upsert',
			{ attributes: { name } },
			currentContext
		);

		try {
			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				const resp = await PUT<VectorUpsertResponse>(
					`/vector/2025-03-17/${encodeURIComponent(name)}`,
					safeStringify(documents)
				);
				if (resp.status === 200) {
					if (resp.json?.success) {
						const json = resp.json as unknown as { data: { id: string; }[]; };
						span.setStatus({ code: SpanStatusCode.OK });
						return json.data.map((o) => o.id);
					}
				}
				if (!resp.json?.success && resp.json?.message) {
					throw new Error(resp.json.message);
				}
				throw new Error('unknown error');
			});
		} catch (ex) {
			recordException(span, ex);
			throw ex;
		} finally {
			span.end();
		}
	}

	/**
	 * get a vector from the vector storage by key
	 *
	 * @param name - the name of the vector storage
	 * @param key - the key of the vector to get
	 * @returns the result of the vector search
	 */
	async get(name: string, key: string): Promise<VectorSearchResult | null> {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan(
			'agentuity.vector.get',
			{ attributes: { name } },
			currentContext
		);

		try {
			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				const resp = await GET<VectorGetResponse>(
					`/vector/2025-03-17/${encodeURIComponent(name)}/${encodeURIComponent(key)}`,
					undefined,
					undefined,
					undefined,
					undefined,
					'vector'
				);
				if (resp.status === 404) {
					span.addEvent('miss');
					span.setStatus({ code: SpanStatusCode.OK });
					return null;
				}
				if (resp.status === 200) {
					if (resp.json?.success) {
						span.addEvent('hit');
						span.setStatus({ code: SpanStatusCode.OK });
						return resp.json.data;
					}
				}
				if (!resp.json?.success && resp.json?.message) {
					throw new Error(resp.json.message);
				}
				throw new Error('unknown error');
			});
		} catch (ex) {
			recordException(span, ex);
			throw ex;
		} finally {
			span.end();
		}
	}

	/**
	 * search for vectors in the vector storage
	 *
	 * @param name - the name of the vector storage
	 * @param params - the parameters for the vector search
	 * @returns the results of the vector search
	 */
	async search<T = unknown>(
		name: string,
		params: VectorSearchParams<T>
	): Promise<VectorSearchResult[]> {
		if (!isJsonObject(params.metadata)) {
			throw new Error('params.metadata must be a JsonObject');
		}
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan(
			'agentuity.vector.search',
			{
				attributes: {
					name,
					query: params.query,
					limit: params.limit,
					similarity: params.similarity,
				},
			},
			currentContext
		);

		try {
			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				const resp = await POST<VectorSearchResponse>(
					`/vector/2025-03-17/search/${encodeURIComponent(name)}`,
					safeStringify(params),
					undefined,
					undefined,
					undefined,
					'vector'
				);
				if (resp.status === 404) {
					span.addEvent('miss');
					span.setStatus({ code: SpanStatusCode.OK });
					return [];
				}
				if (resp.status === 200) {
					if (resp.json?.success) {
						span.addEvent('hit');
						span.setStatus({ code: SpanStatusCode.OK });
						return resp.json.data;
					}
				}
				if (!resp.json?.success && resp.json?.message) {
					throw new Error(resp.json.message);
				}
				throw new Error('unknown error');
			});
		} catch (ex) {
			recordException(span, ex);
			throw ex;
		} finally {
			span.end();
		}
	}

	/**
	 * delete vectors from the vector storage
	 *
	 * @param name - the name of the vector storage
	 * @param keys - the keys of the vectors to delete
	 * @returns the number of vector objects that were deleted
	 */
	async delete(name: string, ...keys: string[]): Promise<number> {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan(
			'agentuity.vector.delete',
			{ attributes: { name, keys: keys.join(',') } },
			currentContext
		);

		try {
			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				if (keys.length === 0) {
					span.setStatus({ code: SpanStatusCode.OK });
					return 0;
				}

				let resp: Awaited<ReturnType<typeof DELETE<VectorDeleteResponse>>>;

				if (keys.length === 1) {
					resp = await DELETE<VectorDeleteResponse>(
						`/vector/2025-03-17/${encodeURIComponent(name)}/${encodeURIComponent(keys[0])}`,
						undefined,
						undefined,
						undefined,
						undefined,
						'vector'
					);
				} else {
					resp = await DELETE<VectorDeleteResponse>(
						`/vector/2025-03-17/${encodeURIComponent(name)}`,
						safeStringify({ keys })
					);
				}

				if (resp.status === 200) {
					if (resp.json?.success) {
						span.addEvent('delete_count', resp.json.data);
						span.setStatus({ code: SpanStatusCode.OK });
						return resp.json.data;
					}
				}
				if (!resp.json?.success && resp.json?.message) {
					throw new Error(resp.json.message);
				}
				throw new Error('unknown error');
			});
		} catch (ex) {
			recordException(span, ex);
			throw ex;
		} finally {
			span.end();
		}
	}
}
