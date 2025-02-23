import type {
	VectorStorage,
	VectorUpsertParams,
	VectorSearchParams,
	VectorSearchResult,
} from "../types";
import { DELETE, POST, PUT } from "./api";

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
		const resp = await PUT<VectorUpsertParams[], VectorUpsertResponse>(
			`/sdk/vector/${encodeURIComponent(name)}`,
			documents,
		);
		if (resp.status === 200) {
			if (resp.json?.success) {
				return resp.json.ids;
			}
		}
		if (!resp.json?.success && resp.json?.error) {
			throw new Error(resp.json.error);
		}
		throw new Error("unknown error");
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
		params: VectorSearchParams,
	): Promise<VectorSearchResult[]> {
		const resp = await POST<VectorSearchParams, VectorSearchResponse>(
			`/sdk/vector/search/${encodeURIComponent(name)}`,
			params,
		);
		if (resp.status === 404) {
			return [];
		}
		if (resp.status === 200) {
			if (resp.json?.success) {
				return resp.json.data;
			}
		}
		if (!resp.json?.success && resp.json?.error) {
			throw new Error(resp.json.error);
		}
		throw new Error("unknown error");
	}

	/**
	 * delete a vector from the vector storage
	 *
	 * @param name - the name of the vector storage
	 * @param ids - the ids of the vectors to delete
	 * @returns the number of vector objects that were deleted
	 */
	async delete(name: string, ...ids: string[]): Promise<number> {
		const resp = await DELETE<string[], VectorDeleteResponse>(
			`/sdk/vector/${encodeURIComponent(name)}`,
			ids,
		);
		if (resp.status === 200) {
			if (resp.json?.success) {
				return resp.json.ids.length;
			}
		}
		if (!resp.json?.success && resp.json?.error) {
			throw new Error(resp.json.error);
		}
		throw new Error("unknown error");
	}
}
