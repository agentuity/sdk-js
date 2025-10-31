import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import type { SmsReply } from '../io/sms';
import { getTracer, recordException } from '../router/router';
import { safeStringify } from '../server/util';
import type { AgentContext, AgentRequest, SMSService } from '../types';
import { POST } from './api';

export default class SmsApi implements SMSService {
	async send(
		_req: AgentRequest,
		ctx: AgentContext,
		to: string[],
		message: SmsReply,
		from?: string
	): Promise<void> {
		const timeout = 15_000;
		const tracer = getTracer();
		const currentContext = context.active();

		const span = tracer.startSpan('agentuity.sms.send', {}, currentContext);

		try {
			const spanContext = trace.setSpan(currentContext, span);

			return await context.with(spanContext, async () => {
				span.setAttribute('@agentuity/agentId', ctx.agent.id);
				const resp = await POST(
					'/sms/send',
					safeStringify({
						agentId: ctx.agent.id,
						from: from,
						to: to,
						message: message.text,
					}),
					{
						'Content-Type': 'application/json',
						Accept: 'application/json',
					},
					timeout
				);
				if (resp.status === 200) {
					span.setStatus({ code: SpanStatusCode.OK });
					return;
				}
				throw new Error(
					`error sending sms: ${resp.response.statusText} (${resp.response.status}): ${resp.json}`
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
	 * @deprecated Use reply on data.email
	 */
	async sendReply(
		_agentId: string,
		_phoneNumber: string,
		_authToken: string,
		_messageId: string
	): Promise<void> {
		throw new Error('reply not supported in context');
	}
}
