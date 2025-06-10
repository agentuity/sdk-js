import { POST } from './api';
import { getTracer, recordException } from '../router/router';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import type { DiscordService } from '../types';

export default class DiscordApi implements DiscordService {
	/**
	 * Send a reply to an incoming Discord message
	 *
	 * @param agentId - the id of the agent to send the reply to
	 * @param messageId - the message id of the discord message
	 * @param channelId - the channel id of the discord message
	 * @param content - the content of the reply
	 */
	async sendReply(
		agentId: string,
		messageId: string,
		channelId: string,
		content: string
	): Promise<void> {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan(
			'agentuity.discord.reply',
			{},
			currentContext
		);

		try {
			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				span.setAttribute('@agentuity/agentId', agentId);
				span.setAttribute('@agentuity/discordMessageId', messageId);
				span.setAttribute('@agentuity/discordChannelId', channelId);

				const payload = JSON.stringify({
					content,
					messageId,
					channelId,
				});

				const resp = await POST(`/discord/${agentId}/reply`, payload, {
					'Content-Type': 'application/json',
				});

				if (resp.status === 200) {
					span.setStatus({ code: SpanStatusCode.OK });
					return;
				}
				throw new Error(
					`error sending discord reply: ${resp.response.statusText} (${resp.response.status})`
				);
			});
		} catch (ex) {
			recordException(span, ex);
			throw ex;
		} finally {
			span.end();
		}
	}
}
