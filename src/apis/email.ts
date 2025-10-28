import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import type { Attachment } from 'nodemailer/lib/mailer/index.js';
import type { EmailReply } from '../io/email';
import { getTracer, recordException } from '../router/router';
import { fromDataType } from '../server/util';
import type { AgentContext, AgentRequest, EmailService } from '../types';
import { POST } from './api';

export default class EmailApi implements EmailService {
	/**
	 * send an email
	 */
	async send(
		req: AgentRequest,
		ctx: AgentContext,
		to: string[],
		email: EmailReply,
		from?: {
			name?: string;
			email?: string;
		}
	): Promise<string> {
		const authToken = req.metadata?.['email-auth-token'] as string;
		if (!authToken) {
			throw new Error(
				'email authorization token is required but not found in metadata'
			);
		}

		const tracer = getTracer();
		const currentContext = context.active();
		const span = tracer.startSpan('agentuity.email.send', {}, currentContext);

		try {
			const spanContext = trace.setSpan(currentContext, span);

			return await context.with(spanContext, async () => {
				let attachments: Attachment[] = [];
				if (email.attachments) {
					attachments = await Promise.all(
						email.attachments.map(async (attachment) => {
							const resp = await fromDataType(attachment.data);
							return {
								filename: attachment.filename,
								content: await resp.data.buffer(),
								contentType: resp.data.contentType,
								contentDisposition:
									attachment.contentDisposition ?? ('attachment' as const),
							};
						})
					);
				}

				const normalizedTo = to.map((addr) => addr.trim()).filter(Boolean);
				if (normalizedTo.length === 0) {
					throw new Error('at least one recipient email is required');
				}

				if (!from?.email) {
					throw new Error('a valid from email address is required');
				}

				const mail = new MailComposer({
					date: new Date(),
					from: {
						name: from?.name ?? ctx.agent.name,
						address: from.email,
					},
					to: normalizedTo.join(', '),
					subject: email.subject ?? '',
					text: email.text,
					html: email.html,
					attachments,
				});
				const newemail = mail.compile();

				return new Promise<string>((resolve, reject) => {
					newemail.build(async (err, message) => {
						if (err) {
							reject(err);
						} else {
							try {
								const messageId = newemail.messageId();
								span.setAttribute('@agentuity/agentId', ctx.agent.id);
								span.setAttribute('@agentuity/emailMessageId', messageId);

								const resp = await POST(
									'/email/send',
									message.toString(),
									{
										'Content-Type': 'message/rfc822',
										'X-Agentuity-Message-Id': messageId,
									},
									undefined,
									authToken
								);
								if (resp.status === 200) {
									span.setStatus({ code: SpanStatusCode.OK });
									resolve(messageId);
								} else {
									const body = await resp.response.text();
									span.setStatus({ code: SpanStatusCode.ERROR, message: body });
									reject(
										new Error(
											`error sending email: ${resp.response.statusText} (${resp.response.status})${body}`
										)
									);
								}
							} catch (ex) {
								reject(ex);
							}
						}
					});
				});
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
		req: AgentRequest,
		ctx: AgentContext,
		inReplyTo: string,
		reply: EmailReply,
		from?: {
			name?: string;
			email?: string;
		}
	): Promise<string> {
		const authToken = req.metadata?.['email-auth-token'] as string;
		if (!authToken) {
			throw new Error(
				'email authorization token is required but not found in metadata'
			);
		}

		const tracer = getTracer();
		const currentContext = context.active();
		const span = tracer.startSpan('agentuity.email.reply', {}, currentContext);

		try {
			const spanContext = trace.setSpan(currentContext, span);

			return await context.with(spanContext, async () => {
				let attachments: Attachment[] = [];
				if (reply.attachments) {
					attachments = await Promise.all(
						reply.attachments.map(async (attachment) => {
							const resp = await fromDataType(attachment.data);
							return {
								filename: attachment.filename,
								content: await resp.data.buffer(),
								contentType: resp.data.contentType,
								contentDisposition:
									attachment.contentDisposition ?? ('attachment' as const),
							};
						})
					);
				}

				if (!from?.email) {
					throw new Error('a valid from email address is required');
				}

				const mail = new MailComposer({
					inReplyTo: inReplyTo,
					references: inReplyTo,
					date: new Date(),
					from: {
						name: from?.name ?? ctx.agent.name,
						address: from.email,
					},
					subject: reply.subject ?? '',
					text: reply.text,
					html: reply.html,
					attachments,
				});
				const newemail = mail.compile();

				return new Promise<string>((resolve, reject) => {
					newemail.build(async (err, message) => {
						if (err) {
							reject(err);
						} else {
							try {
								const messageId = newemail.messageId();
								span.setAttribute('@agentuity/agentId', ctx.agent.id);
								span.setAttribute('@agentuity/emailMessageId', messageId);

								const resp = await POST(
									`/email/2025-03-17/${ctx.agent.id}/reply`,
									message.toString(),
									{
										'Content-Type': 'message/rfc822',
										'X-Agentuity-Message-Id': messageId,
									},
									undefined,
									authToken
								);
								if (resp.status === 200) {
									span.setStatus({ code: SpanStatusCode.OK });
									resolve(messageId);
								} else {
									const body = await resp.response.text();
									span.setStatus({ code: SpanStatusCode.ERROR, message: body });
									reject(
										new Error(
											`error sending email reply: ${resp.response.statusText} (${resp.response.status})${body}`
										)
									);
								}
							} catch (ex) {
								reject(ex);
							}
						}
					});
				});
			});
		} catch (ex) {
			recordException(span, ex);
			throw ex;
		} finally {
			span.end();
		}
	}
}
