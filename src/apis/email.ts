import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { getTracer, recordException } from '../router/router';
import type { EmailService } from '../types';
import { POST } from './api';

export default class EmailApi implements EmailService {
	/**
	 * send an email
	 */
	async send(
		agentId: string,
		email: string,
		authToken: string,
		messageId: string
	): Promise<void> {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan('agentuity.email.send', {}, currentContext);

		try {
			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				span.setAttribute('@agentuity/agentId', agentId);
				span.setAttribute('@agentuity/emailMessageId', messageId);

				const resp = await POST(
					'/email/send',
					email,
					{
						'Content-Type': 'message/rfc822',
						'X-Agentuity-Message-Id': messageId,
					},
					undefined,
					authToken
				);
				if (resp.status === 200) {
					span.setStatus({ code: SpanStatusCode.OK });
					return;
				}
				const body = await resp.response.text();
				span.setStatus({ code: SpanStatusCode.ERROR, message: body });
				throw new Error(
					`error sending email: ${resp.response.statusText} (${resp.response.status})body`
				);
			});
		} catch (ex) {
			recordException(span, ex);
			throw ex;
		} finally {
			span.end();
		}
	}

	/**
	 * send an email reply to an incoming email
	 */
	async sendReply(
		agentId: string,
		email: string,
		authToken: string,
		messageId: string
	): Promise<void> {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan('agentuity.email.reply', {}, currentContext);

		try {
			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				span.setAttribute('@agentuity/agentId', agentId);
				span.setAttribute('@agentuity/emailMessageId', messageId);

				const resp = await POST(
					`/email/2025-03-17/${agentId}/reply`,
					email,
					{
						'Content-Type': 'message/rfc822',
						'X-Agentuity-Message-Id': messageId,
					},
					undefined,
					authToken
				);
				if (resp.status === 200) {
					span.setStatus({ code: SpanStatusCode.OK });
					return;
				}
				const body = await resp.response.text();
				span.setStatus({ code: SpanStatusCode.ERROR, message: body });
				throw new Error(
					`error sending email reply: ${resp.response.statusText} (${resp.response.status})${body}`
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
