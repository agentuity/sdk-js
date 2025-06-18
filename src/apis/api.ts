import { getSDKVersion } from '../router/router';

// allow the fetch function to be overridden
let apiFetch = globalThis.fetch;

// only used in tests
export function setFetch(f: typeof fetch) {
	apiFetch = f;
}

interface ApiRequestWithPath {
	/**
	 * The path to send the request to
	 */
	path: string;
}
interface ApiRequestWithUrl {
	/**
	 * The full URL to send the request to
	 */
	url: string;
}

type ApiRequestOptions = ApiRequestWithPath | ApiRequestWithUrl;

interface ApiRequestBase {
	method: 'POST' | 'GET' | 'PUT' | 'DELETE';
	timeout?: number;
	headers?: Record<string, string>;
	authToken?: string;
}

type BaseApiRequest = ApiRequestOptions & ApiRequestBase;

/**
 * Represents the body of an API request
 */
export type Body = string | ArrayBuffer | ReadableStream | Blob | FormData;

type GetApiRequest = BaseApiRequest & {
	method: 'GET';
	body?: never;
};

type PostApiRequest = BaseApiRequest & {
	method: 'POST';
	body: Body;
};

type PutApiRequest = BaseApiRequest & {
	method: 'PUT';
	body: Body;
};

type DeleteApiRequest = BaseApiRequest & {
	method: 'DELETE';
	body?: Body;
};

type ApiRequest =
	| GetApiRequest
	| PostApiRequest
	| PutApiRequest
	| DeleteApiRequest;

interface APIResponse<T> {
	json: T | null;
	headers: Response['headers'];
	status: number;
	response: Response;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends an API request
 *
 * @param request - The API request to send
 * @param forceBuffer - Whether to force the response to be treated as a buffer
 * @param attempt - The current attempt number (for retries)
 * @returns The API response
 * @throws Error if the API key is not set
 */
export async function send<K>(
	request: ApiRequest,
	forceBuffer = false,
	attempt = 1
): Promise<APIResponse<K>> {
	const apiKey =
		request.authToken ??
		(process.env.AGENTUITY_SDK_KEY || process.env.AGENTUITY_API_KEY);
	if (!apiKey) {
		throw new Error('AGENTUITY_API_KEY or AGENTUITY_SDK_KEY is not set');
	}
	const url =
		'path' in request
			? new URL(
					request.path,
					process.env.AGENTUITY_TRANSPORT_URL || 'https://agentuity.ai/'
				)
			: new URL(request.url);
	const sdkVersion = getSDKVersion();
	const headers: Record<string, string> = {
		Accept: 'application/json',
		'Content-Type': 'application/json',
		'User-Agent': `Agentuity JS SDK/${sdkVersion}`,
	};
	// allow headers to be overridden
	for (const key in request.headers) {
		headers[key] = request.headers[key];
	}
	// this shouldn't be overridden
	headers.Authorization = `Bearer ${apiKey}`;
	const resp = await apiFetch(url, {
		method: request.method,
		body: request.body,
		headers,
		keepalive: true,
		signal: AbortSignal.timeout(request.timeout || 20_000),
	});
	let json: K | null = null;
	switch (resp.status) {
		case 429: {
			if (attempt < 3) {
				const wait = 250 * 2 ** attempt;
				await sleep(wait);
				return send(request, forceBuffer, attempt + 1);
			}
			break;
		}
		case 200:
		case 201:
		case 202: {
			if (!forceBuffer) {
				const contentType = resp.headers.get('content-type');
				if (contentType?.includes('/json')) {
					json = (await resp.json()) as K;
				}
			}
			break;
		}
		default:
			break;
	}
	return {
		json,
		headers: resp.headers,
		status: resp.status,
		response: resp,
	};
}

/**
 * Sends a GET request
 *
 * @param path - The path to send the request to
 * @param forceBuffer - Whether to force the response to be treated as a buffer
 * @param headers - Additional headers for the request
 * @param timeout - The timeout for the request
 * @returns The API response
 */
export async function GET<K>(
	path: string,
	forceBuffer?: boolean,
	headers?: Record<string, string>,
	timeout?: number
) {
	return send<K>(
		{
			method: 'GET',
			path,
			headers,
			timeout,
		} as GetApiRequest,
		forceBuffer
	);
}

/**
 * Sends a POST request
 *
 * @param path - The path to send the request to
 * @param body - The body of the request
 * @param headers - Additional headers for the request
 * @param timeout - The timeout for the request
 * @returns The API response
 */
export async function POST<K>(
	path: string,
	body: Body,
	headers?: Record<string, string>,
	timeout?: number,
	authToken?: string
) {
	return send<K>({
		method: 'POST',
		path,
		body,
		headers,
		timeout,
		authToken,
	} as PostApiRequest);
}

/**
 * Sends a PUT request
 *
 * @param path - The path to send the request to
 * @param body - The body of the request
 * @param headers - Additional headers for the request
 * @param timeout - The timeout for the request
 * @returns The API response
 */
export async function PUT<K>(
	path: string,
	body: Body,
	headers?: Record<string, string>,
	timeout?: number
) {
	return send<K>({
		method: 'PUT',
		path,
		body,
		timeout,
		headers,
	} as PutApiRequest);
}

/**
 * Sends a DELETE request
 *
 * @param path - The path to send the request to
 * @param body - The body of the request
 * @param headers - Additional headers for the request
 * @param timeout - The timeout for the request
 * @returns The API response
 */
export async function DELETE<K>(
	path: string,
	body?: Body,
	headers?: Record<string, string>,
	timeout?: number
) {
	return send<K>({
		method: 'DELETE',
		path,
		body,
		timeout,
		headers,
	} as DeleteApiRequest);
}
