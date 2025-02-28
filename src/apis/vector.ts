import type {
	VectorStorage,
	VectorUpsertParams,
	VectorSearchParams,
	VectorSearchResult,
} from '../types';
import { DELETE, POST, PUT } from './api';
import { getTracer, recordException } from '../router/router';
import { context, trace } from '@opentelemetry/api';

interface VectorUpsertSuccessResponse {
	success: true;
	ids: string[];
}

interface VectorUpsertErrorResponse {
	success: false;
	error: string;
}

type VectorUpsertResponse =
	| VectorUpsertSuccessResponse
	| VectorUpsertErrorResponse;

interface VectorSearchSuccessResponse {
	success: true;
	data: VectorSearchResult[];
}

interface VectorSearchErrorResponse {
	success: false;
	error: string;
}

type VectorSearchResponse =
	| VectorSearchSuccessResponse
	| VectorSearchErrorResponse;

interface VectorDeleteSuccessResponse {
	success: true;
	ids: string[];
}

interface VectorDeleteErrorResponse {
	success: false;
	error: string;
}

type VectorDeleteResponse =
	| VectorDeleteSuccessResponse
	| VectorDeleteErrorResponse;

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
			{},
			currentContext
		);

		try {
			span.setAttribute('name', name);

			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				const resp = await PUT<VectorUpsertResponse>(
					`/sdk/vector/${encodeURIComponent(name)}`,
					JSON.stringify(documents)
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
			{},
			currentContext
		);

		try {
			span.setAttribute('name', name);

			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				const resp = await POST<VectorSearchResponse>(
					`/sdk/vector/search/${encodeURIComponent(name)}`,
					JSON.stringify(params)
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
	 * @param ids - the ids of the vectors to delete
	 * @returns the number of vector objects that were deleted
	 */
	async delete(name: string, ...ids: string[]): Promise<number> {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan(
			'agentuity.vector.delete',
			{},
			currentContext
		);

		try {
			span.setAttribute('name', name);

			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				const resp = await DELETE<VectorDeleteResponse>(
					`/sdk/vector/${encodeURIComponent(name)}`,
					JSON.stringify(ids)
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
