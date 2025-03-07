import type {
	VectorStorage,
	VectorUpsertParams,
	VectorSearchParams,
	VectorSearchResult,
} from '../types';
import { DELETE, POST, PUT } from './api';
import { getTracer, recordException } from '../router/router';
import { context, trace } from '@opentelemetry/api';
import { safeStringify } from '../server/util';

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
	error: string;
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
	error: string;
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
	ids: string[];
}

/**
 * Response for a failed vector delete operation
 */
interface VectorDeleteErrorResponse {
	success: false;
	error: string;
}

/**
 * Response for a vector delete operation
 */
type VectorDeleteResponse =
	| VectorDeleteSuccessResponse
	| VectorDeleteErrorResponse;

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
					`/sdk/vector/${encodeURIComponent(name)}`,
					safeStringify(documents)
				);
				if (resp.status === 200) {
					if (resp.json?.success) {
						const json = resp.json as unknown as { data: { id: string }[] };
						return json.data.map((o) => o.id);
					}
				}
				if (!resp.json?.success && resp.json?.error) {
					throw new Error(resp.json.error);
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
	async search(
		name: string,
		params: VectorSearchParams
	): Promise<VectorSearchResult[]> {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan(
			'agentuity.vector.search',
			{ attributes: { name } },
			currentContext
		);

		try {
			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				const resp = await POST<VectorSearchResponse>(
					`/sdk/vector/search/${encodeURIComponent(name)}`,
					safeStringify(params)
				);
				if (resp.status === 404) {
					span.addEvent('miss');
					return [];
				}
				if (resp.status === 200) {
					if (resp.json?.success) {
						span.addEvent('hit');
						return resp.json.data;
					}
				}
				if (!resp.json?.success && resp.json?.error) {
					throw new Error(resp.json.error);
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
	 * delete a vector from the vector storage
	 *
	 * @param name - the name of the vector storage
	 * @param key  - the ids of the vectors to delete
	 * @returns the number of vector objects that were deleted
	 */
	async delete(name: string, key: string): Promise<number> {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan(
			'agentuity.vector.delete',
			{ attributes: { name } },
			currentContext
		);

		try {
			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				const resp = await DELETE<VectorDeleteResponse>(
					`/sdk/vector/${encodeURIComponent(name)}/${encodeURIComponent(key)}`
				);
				if (resp.status === 200) {
					if (resp.json?.success) {
						return resp.json.ids.length;
					}
				}
				if (!resp.json?.success && resp.json?.error) {
					throw new Error(resp.json.error);
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
