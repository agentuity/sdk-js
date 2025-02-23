import type {
	VectorStorage,
	VectorUpsertParams,
	VectorSearchParams,
	VectorSearchResult,
} from '../types';
import { DELETE, POST, PUT } from './api';
import { getTracer, recordException } from '../router/router';

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
		return new Promise<string[]>((resolve, reject) => {
			tracer.startActiveSpan('agentuity.vector.upsert', async (span) => {
				try {
					span.setAttribute('name', name);
					const resp = await PUT<VectorUpsertResponse>(
						`/sdk/vector/${encodeURIComponent(name)}`,
						JSON.stringify(documents)
					);
					if (resp.status === 200) {
						if (resp.json?.success) {
							const json = resp.json as unknown as { data: { id: string }[] };
							resolve(json.data.map((o) => o.id));
							return;
						}
					}
					if (!resp.json?.success && resp.json?.error) {
						throw new Error(resp.json.error);
					}
					throw new Error('unknown error');
				} catch (ex) {
					recordException(span, ex);
					reject(ex);
				} finally {
					span.end();
				}
			});
		});
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
		return new Promise<VectorSearchResult[]>((resolve, reject) => {
			tracer.startActiveSpan('agentuity.vector.search', async (span) => {
				span.setAttribute('name', name);
				try {
					const resp = await POST<VectorSearchResponse>(
						`/sdk/vector/search/${encodeURIComponent(name)}`,
						JSON.stringify(params)
					);
					if (resp.status === 404) {
						span.addEvent('miss');
						resolve([]);
						return;
					}
					if (resp.status === 200) {
						if (resp.json?.success) {
							span.addEvent('hit');
							resolve(resp.json.data);
							return;
						}
					}
					if (!resp.json?.success && resp.json?.error) {
						throw new Error(resp.json.error);
					}
					throw new Error('unknown error');
				} catch (ex) {
					recordException(span, ex);
					reject(ex);
				} finally {
					span.end();
				}
			});
		});
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
		return new Promise<number>((resolve, reject) => {
			tracer.startActiveSpan('agentuity.vector.delete', async (span) => {
				span.setAttribute('name', name);
				try {
					const resp = await DELETE<VectorDeleteResponse>(
						`/sdk/vector/${encodeURIComponent(name)}`,
						JSON.stringify(ids)
					);
					if (resp.status === 200) {
						if (resp.json?.success) {
							resolve(resp.json.ids.length);
							return;
						}
					}
					if (!resp.json?.success && resp.json?.error) {
						throw new Error(resp.json.error);
					}
					throw new Error('unknown error');
				} catch (ex) {
					recordException(span, ex);
					reject(ex);
				} finally {
					span.end();
				}
			});
		});
	}
}
