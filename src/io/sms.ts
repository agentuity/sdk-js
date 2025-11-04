import { inspect } from 'node:util';
import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { POST } from '../apis/api';
import { getTracer, recordException } from '../router/router';
import { safeStringify } from '../server/util';
import type { AgentContext, AgentRequest } from '../types';

type TwilioResponse = {
	Body: string;
	From: string;
	MessageSid: string;
	To: string;
};

/**
 * A reply to an SMS
 */
export interface SmsReply {
	/**
	 * the text body of the reply
	 */
	text: string;
}

/**
 * A class representing an sms with the common information so processing can be done on it.
 */
export class Sms {
	private readonly _message: TwilioResponse;

	constructor(data: TwilioResponse) {
		this._message = data;
	}

	[inspect.custom]() {
		return this.toString();
	}

	toString() {
		return JSON.stringify(this._message);
	}
	get messageId(): string {
		return this._message.MessageSid;
	}

	get to(): string {
		return this._message.To;
	}
	get from(): string {
		return this._message.From;
	}

	get text(): string {
		return this._message.Body;
	}

	async send(
		req: AgentRequest,
		ctx: AgentContext,
		to: string[],
		message: SmsReply,
		from?: string
	) {
		const timeout = 15_000;
		const tracer = getTracer();
		const currentContext = context.active();

		const authToken = req.metadata?.['twilio-auth-token'] as string;
		if (!authToken) {
			throw new Error(
				'twilio authorization token is required but not found in metadata'
			);
		}

		const span = tracer.startSpan('agentuity.twilio.send', {}, currentContext);

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
					},
					timeout,
					authToken
				);
				if (resp.status === 200) {
					span.setStatus({ code: SpanStatusCode.OK });
					return;
				}
				throw new Error(
					`error sending sms: ${resp.response.statusText} (${resp.response.status})`
				);
			});
		} catch (ex) {
			recordException(span, ex);
			throw ex;
		} finally {
			span.end();
		}
	}

	async sendReply(req: AgentRequest, ctx: AgentContext, reply: string) {
		const timeout = 15_000;
		const tracer = getTracer();
		const currentContext = context.active();

		const authToken = req.metadata?.['twilio-auth-token'] as string;
		if (!authToken) {
			throw new Error(
				'twilio authorization token is required but not found in metadata'
			);
		}
		// Create a child span using the current context
		const span = tracer.startSpan('agentuity.twilio.reply', {}, currentContext);

		try {
			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				span.setAttribute('@agentuity/agentId', ctx.agent.id);
				span.setAttribute('@agentuity/twilioMessageId', this.messageId);
				const resp = await POST(
					'/sms/twilio/reply',
					safeStringify({
						to: this.from,
						from: this.to,
						reply: reply,
						agentId: ctx.agent.id,
					}),
					{
						'Content-Type': 'application/json',
						'X-Agentuity-Message-Id': this.messageId,
					},
					timeout,
					authToken
				);
				if (resp.status === 200) {
					span.setStatus({ code: SpanStatusCode.OK });
					return;
				}
				throw new Error(
					`error sending sms reply: ${resp.response.statusText} (${resp.response.status})`
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

/**
 * Parse an email from a buffer and return an Email object.
 */
export async function parseSms(data: Buffer): Promise<Sms> {
	try {
		const message = JSON.parse(data.toString()) as TwilioResponse;
		return new Sms(message);
	} catch (error) {
		throw new Error(
			`Failed to parse sms: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

