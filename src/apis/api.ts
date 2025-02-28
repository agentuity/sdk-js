import { getSDKVersion } from '../router/router';

interface BaseApiRequest {
	method: 'POST' | 'GET' | 'PUT' | 'DELETE';
	path: string;
	timeout?: number;
	headers?: Record<string, string>;
}

/**
 * Represents the body of an API request
 */
export type Body = string | ArrayBuffer | ReadableStream | Blob | FormData;

interface GetApiRequest extends BaseApiRequest {
	method: 'GET';
	body: never;
}

interface PostApiRequest extends BaseApiRequest {
	method: 'POST';
	body: Body;
}

interface PutApiRequest extends BaseApiRequest {
	method: 'PUT';
	body: Body;
}

interface DeleteApiRequest extends BaseApiRequest {
	method: 'DELETE';
	body?: Body;
}

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
	const apiKey = process.env.AGENTUITY_API_KEY;
	if (!apiKey) {
		throw new Error('AGENTUITY_API_KEY is not set');
	}
	const url = new URL(
		request.path,
		process.env.AGENTUITY_URL || 'https://api.agentuity.com'
	);
	const sdkVersion = getSDKVersion();
	const headers: Record<string, string> = {
		Accept: 'application/json',
		'Content-Type': 'application/json',
		'User-Agent': `@agentuity/sdk (${sdkVersion})`,
	};
	// allow headers to be overridden
	for (const key in request.headers) {
		headers[key] = request.headers[key];
	}
	// this shouldn't be overridden
	headers.Authorization = `Bearer ${apiKey}`;
	const resp = await fetch(url, {
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
	timeout?: number
) {
	return send<K>({
		method: 'POST',
		path,
		body,
		headers,
		timeout,
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
