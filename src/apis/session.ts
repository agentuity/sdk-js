import { POST } from './api';

/**
 * Mark the current session as completed and pass the duration of the async execution in milliseconds.
 */
export async function markSessionCompleted(
	sessionId: string,
	duration: number
): Promise<void> {
	const resp = await POST<void>(
		'/agent/2025-03-17/session-completed',
		JSON.stringify({ sessionId, duration })
	);
	if (resp.status === 202) {
		return;
	}
	throw new Error(await resp.response.text());
}
