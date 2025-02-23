interface BaseApiRequest {
	method: "POST" | "GET" | "PUT" | "DELETE";
	path: string;
	timeout?: number;
}

interface GetApiRequest extends BaseApiRequest {
	method: "GET";
	body: never;
}

interface PostApiRequest<T> extends BaseApiRequest {
	method: "POST";
	body: T;
}

interface PutApiRequest<T> extends BaseApiRequest {
	method: "PUT";
	body: T;
}

interface DeleteApiRequest<T> extends BaseApiRequest {
	method: "DELETE";
	body?: T;
}

type ApiRequest<T> =
	| GetApiRequest
	| PostApiRequest<T>
	| PutApiRequest<T>
	| DeleteApiRequest<T>;

interface APIResponse<T> {
	json: T | null;
	headers: Response["headers"];
	status: number;
	response: Response;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function send<T, K>(
	request: ApiRequest<T>,
	attempt = 1,
): Promise<APIResponse<K>> {
	const apiKey = process.env.AGENTUITY_API_KEY;
	if (!apiKey) {
		throw new Error("AGENTUITY_API_KEY is not set");
	}
	const url = new URL(
		request.path,
		process.env.AGENTUITY_URL || "https://api.agentuity.com",
	);
	const resp = await fetch(url, {
		method: request.method,
		body: JSON.stringify(request.body),
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			"User-Agent": "@agentuity/sdk",
			Authorization: `Bearer ${apiKey}`,
		},
		keepalive: true,
		signal: AbortSignal.timeout(request.timeout || 20_000),
	});
	let json: K | null = null;
	switch (resp.status) {
		case 429: {
			if (attempt < 3) {
				const wait = 250 * 2 ** attempt;
				await sleep(wait);
				return send(request, attempt + 1);
			}
			break;
		}
		case 200:
		case 201:
		case 202: {
			const contentType = resp.headers.get("content-type");
			if (contentType?.includes("/json")) {
				json = (await resp.json()) as K;
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

export async function GET<K>(path: string, timeout?: number) {
	return send<never, K>({
		method: "GET",
		path,
		timeout,
	} as GetApiRequest);
}

export async function POST<T, K>(path: string, body: T, timeout?: number) {
	return send<T, K>({
		method: "POST",
		path,
		body,
		timeout,
	} as PostApiRequest<T>);
}

export async function PUT<T, K>(path: string, body: T, timeout?: number) {
	return send<T, K>({ method: "PUT", path, body, timeout } as PutApiRequest<T>);
}

export async function DELETE<T, K>(path: string, body?: T, timeout?: number) {
	return send<T, K>({
		method: "DELETE",
		path,
		body,
		timeout,
	} as DeleteApiRequest<T>);
}
