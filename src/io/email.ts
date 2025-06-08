import type { ReadableStream } from 'node:stream/web';
import { type ParsedMail, type Headers, simpleParser } from 'mailparser';
import { inspect } from 'node:util';
import MailComposer from 'nodemailer/lib/mail-composer';
import type { Address, Attachment } from 'nodemailer/lib/mailer';
import type {
	AgentContext,
	AgentRequest,
	Data,
	DataType,
	ReadableDataType,
} from '../types';
import { fromDataType } from '../server/util';
import { DataHandler } from '../router/data';
import { send } from '../apis/api';
import { getTracer, recordException } from '../router/router';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';

/**
 * An attachment to an incoming email
 */
export interface IncomingEmailAttachment {
	/**
	 * the filename of the attachment
	 */
	filename: string;

	/**
	 * the data payload of the attachment. This is a promise that resolves to a Data object.
	 */
	data(): Promise<Data>;

	/**
	 * the content disposition of the attachment. if not provided, it will be 'attachment'.
	 */
	contentDisposition: 'attachment' | 'inline';
}

/**
 * An attachment to an outgoing email
 */
export interface OutgoingEmailAttachment {
	/**
	 * the filename of the attachment
	 */
	filename: string;

	/**
	 * the data of the attachment
	 */
	data: DataType;

	/**
	 * the content disposition of the attachment. if not provided, it will be 'attachment'.
	 */
	contentDisposition?: 'attachment' | 'inline' | undefined;
}

class RemoteEmailAttachment implements IncomingEmailAttachment {
	public readonly filename: string;
	public readonly contentDisposition: 'attachment' | 'inline';
	private readonly _url: string;

	constructor(
		filename: string,
		url: string,
		contentDisposition?: 'attachment' | 'inline'
	) {
		this.filename = filename;
		this.contentDisposition = contentDisposition ?? 'attachment';
		this._url = url;
	}

	async data(): Promise<Data> {
		const tracer = getTracer();
		const currentContext = context.active();
		const span = tracer.startSpan(
			'agentuity.email.attachment',
			{},
			currentContext
		);
		try {
			const spanContext = trace.setSpan(currentContext, span);
			return await context.with(spanContext, async () => {
				const res = await send({ url: this._url, method: 'GET' }, true);
				if (res.status === 200) {
					span.setStatus({ code: SpanStatusCode.OK });
					return new DataHandler(
						res.response.body as unknown as ReadableStream<ReadableDataType>,
						res.headers.get('content-type') ?? 'application/octet-stream'
					);
				}
				throw new Error(`Failed to fetch attachment: ${res.status}`);
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
 * A reply to an email
 */
export interface EmailReply {
	/**
	 * the subject of the reply. If not provided, it will be 'RE: <original subject>'.
	 */
	subject?: string;

	/**
	 * the text body of the reply
	 */
	text: string;

	/**
	 * the optional html body of the reply
	 */
	html?: string;

	/**
	 * the optional attachments to the email
	 */
	attachments?: OutgoingEmailAttachment[];
}

/**
 * A class representing an email with the common information so processing can be done on it.
 */
export class Email {
	private readonly _message: ParsedMail;

	constructor(data: ParsedMail) {
		this._message = data;
	}

	[inspect.custom]() {
		return this.toString();
	}

	toString() {
		return `[Email id=${this.messageId()},from=${this.fromEmail()},subject=${this.subject()}]`;
	}

	/**
	 * The date of the email.
	 */
	date(): Date | null {
		return this._message.date ?? null;
	}

	/**
	 * The message ID of the email.
	 */
	messageId(): string | null {
		return this._message.messageId ?? null;
	}

	/**
	 * The headers of the email.
	 */
	headers(): Headers {
		return this._message.headers;
	}

	/**
	 * The email address of the recipient or null if there is no recipient.
	 *
	 * If the email has multiple recipients, the email addresses are comma separated.
	 */
	to(): string | null {
		if (!this._message.to) {
			return null;
		}
		if (Array.isArray(this._message.to)) {
			return this._message.to.map((addr) => addr.text.trim()).join(', ');
		}
		if (typeof this._message.to === 'object' && 'text' in this._message.to) {
			return this._message.to.text;
		}
		return null;
	}

	/**
	 * The email address of the sender or null if there is no sender.
	 */
	fromEmail(): string | null {
		return this._message.from?.value[0]?.address ?? null;
	}

	/**
	 * The name of the sender or null if there is no name.
	 */
	fromName(): string | null {
		return this._message.from?.value[0]?.name ?? null;
	}

	/**
	 * The subject of the email or null if there is no subject.
	 */
	subject(): string | null {
		return this._message.subject ?? null;
	}

	/**
	 * The plain text body of the email or null if there is no plain text body.
	 */
	text(): string | null {
		return this._message.text ?? null;
	}

	/**
	 * The HTML body of the email or null if there is no HTML body.
	 */
	html(): string | null {
		return this._message.html ? this._message.html : null;
	}

	/**
	 * The attachments of the email or an empty array if there are no attachments.
	 */
	attachments(): IncomingEmailAttachment[] {
		if (!this._message.attachments || this._message.attachments.length === 0) {
			return [];
		}
		return this._message.attachments.map((att) => {
			const hv = att.headers.get('content-disposition') as {
				value: string;
				params: Record<string, string>;
			};
			if (!hv || !hv.params) {
				throw new Error(
					'Invalid attachment headers: missing content-disposition'
				);
			}
			if (!hv.params.filename || !hv.params.url) {
				throw new Error('Invalid attachment headers: missing filename or url');
			}
			return new RemoteEmailAttachment(
				hv.params.filename,
				hv.params.url,
				hv.value as 'attachment' | 'inline' | undefined
			);
		});
	}

	private makeReplySubject(subject: string | undefined): string {
		if (subject) {
			return subject;
		}
		const _subject = this.subject();
		if (_subject) {
			if (_subject.toUpperCase().startsWith('RE:')) {
				return _subject;
			}
			return `RE: ${_subject}`;
		}
		return '';
	}

	/**
	 * send a reply to the email
	 */
	async sendReply(
		req: AgentRequest,
		context: AgentContext,
		reply: EmailReply
	): Promise<string> {
		const authToken = req.metadata?.['email-auth-token'] as string;
		if (!authToken) {
			throw new Error(
				'email authorization token is required but not found in metadata'
			);
		}
		// biome-ignore lint/suspicious/noAsyncPromiseExecutor: <explanation>
		return new Promise<string>(async (resolve, reject) => {
			try {
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
				const mail = new MailComposer({
					inReplyTo: this.messageId() ?? undefined,
					references: this.messageId() ?? undefined,
					date: new Date(),
					from: {
						name: context.agent.name,
						address: this.to() as string,
					},
					to: {
						name: this.fromName() ?? undefined,
						address: this.fromEmail() ?? undefined,
					} as Address,
					subject: this.makeReplySubject(reply.subject),
					text: reply.text,
					html: reply.html,
					attachments,
				});
				const newemail = mail.compile();
				newemail.build(async (err, message) => {
					if (err) {
						reject(err);
					} else {
						try {
							await context.email.sendReply(
								context.agent.id,
								message.toString(),
								authToken,
								newemail.messageId()
							);
							resolve(newemail.messageId());
						} catch (ex) {
							reject(ex);
						}
					}
				});
			} catch (ex) {
				reject(ex);
			}
		});
	}
}

/**
 * Parse an email from a buffer and return an Email object.
 */
export async function parseEmail(data: Buffer): Promise<Email> {
	try {
		const message = await simpleParser(data);
		return new Email(message);
	} catch (error) {
		throw new Error(
			`Failed to parse email: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}
