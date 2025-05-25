import { type ParsedMail, type Headers, simpleParser } from 'mailparser';
import { inspect } from 'node:util';
import MailComposer from 'nodemailer/lib/mail-composer';
import type { Address, Attachment } from 'nodemailer/lib/mailer';
import type { AgentContext, AgentRequest, DataType } from '../types';
import { fromDataType } from '../server/util';

/**
 * An attachment to an email
 */
export interface EmailAttachment {
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
	attachments?: EmailAttachment[];
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
	attachments(): Attachment[] {
		return (this._message.attachments ?? []).map((att) => ({
			filename: att.filename || 'attachment',
			content: att.content,
			contentType: att.contentType,
			contentDisposition: 'attachment' as const,
		}));
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
					date: new Date(),
					from: this.to() as string,
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
