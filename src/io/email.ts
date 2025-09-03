import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';
import type { ReadableStream } from 'node:stream/web';
import { inspect } from 'node:util';
import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { type Headers, type ParsedMail, simpleParser } from 'mailparser';
import MailComposer from 'nodemailer/lib/mail-composer';
import type { Address, Attachment } from 'nodemailer/lib/mailer';
import { send } from '../apis/api';
import { DataHandler } from '../router/data';
import { getTracer, recordException } from '../router/router';
import { fromDataType } from '../server/util';
import type {
	AgentContext,
	AgentRequest,
	Data,
	DataType,
	ReadableDataType,
} from '../types';

/**
 * Check if IPv4 address is in private/reserved ranges
 */
function isPrivateIPv4(octets: number[]): boolean {
	if (octets.length !== 4) return false;
	
	const [a, b] = octets;
	
	if (a === 10) return true;
	
	if (a === 172 && b >= 16 && b <= 31) return true;
	
	if (a === 192 && b === 168) return true;
	
	if (a === 100 && b >= 64 && b <= 127) return true;
	
	if (a === 169 && b === 254) return true;
	
	if (a === 127) return true;
	
	if (a === 0) return true;
	
	return false;
}

/**
 * Check if IPv6 address is in blocked ranges
 */
function isBlockedIPv6(addr: string): boolean {
	let normalized = addr.toLowerCase().trim();
	
	if (normalized.startsWith('[') && normalized.endsWith(']')) {
		normalized = normalized.slice(1, -1);
	}
	
	if (normalized === '::1') return true;
	
	if (normalized === '::') return true;
	
	if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || 
		normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
	
	if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
	
	if (normalized.startsWith('::ffff:')) {
		const ipv4Part = normalized.substring(7);
		const ipv4Match = ipv4Part.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
		if (ipv4Match) {
			const octets = ipv4Match.slice(1).map(Number);
			return isPrivateIPv4(octets);
		}
		const hexMatch = ipv4Part.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
		if (hexMatch) {
			const high = Number.parseInt(hexMatch[1], 16);
			const low = Number.parseInt(hexMatch[2], 16);
			const octets = [
				(high >> 8) & 0xff,
				high & 0xff,
				(low >> 8) & 0xff,
				low & 0xff
			];
			return isPrivateIPv4(octets);
		}
	}
	
	return false;
}

/**
 * Check if hostname resolves to private or local addresses
 */
async function isResolvableToPrivateOrLocal(hostname: string): Promise<boolean> {
	const ipVersion = isIP(hostname);
	if (ipVersion === 4) {
		const octets = hostname.split('.').map(Number);
		return isPrivateIPv4(octets);
	}
	if (ipVersion === 6) {
		return isBlockedIPv6(hostname);
	}
	
	try {
		const result = await dns.lookup(hostname, { all: true, verbatim: true });
		
		for (const { address, family } of result) {
			if (family === 4) {
				const octets = address.split('.').map(Number);
				if (isPrivateIPv4(octets)) return true;
			} else if (family === 6) {
				if (isBlockedIPv6(address)) return true;
			}
		}
		
		return false;
	} catch {
		return false;
	}
}

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
				const parsed = new URL(this._url);
				const hostname = parsed.hostname.toLowerCase().trim();
				
				const isPrivateOrLocal = await isResolvableToPrivateOrLocal(hostname);
				if (isPrivateOrLocal) {
					throw new Error('Access to private or local network addresses is not allowed');
				}
				
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
	 * The email address of the first recipient or null if there is no recipient.
	 */
	toEmail(): string | null {
		if (!this._message.to) {
			return null;
		}
		if (Array.isArray(this._message.to)) {
			return this._message.to[0]?.value[0]?.address ?? null;
		}
		if (typeof this._message.to === 'object' && 'value' in this._message.to) {
			return this._message.to.value[0]?.address ?? null;
		}
		return null;
	}

	/**
	 * The name of the first recipient or null if there is no name.
	 */
	toName(): string | null {
		if (!this._message.to) {
			return null;
		}
		if (Array.isArray(this._message.to)) {
			return this._message.to[0]?.value[0]?.name ?? null;
		}
		if (typeof this._message.to === 'object' && 'value' in this._message.to) {
			return this._message.to.value[0]?.name ?? null;
		}
		return null;
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
		const validAttachments: IncomingEmailAttachment[] = [];
		
		for (const att of this._message.attachments) {
			const hv = att.headers.get('content-disposition') as {
				value: string;
				params: Record<string, string>;
			};
			if (!hv || !hv.params) {
				throw new Error(
					'Invalid attachment headers: missing content-disposition'
				);
			}
			
			const filename =
				hv.params.filename ??
				hv.params['filename*'] ??
				(att as { filename?: string }).filename ??
				undefined;
			if (!filename) {
				throw new Error('Invalid attachment headers: missing filename');
			}

			const rawUrl = hv.params.url?.trim();
			if (!rawUrl) {
				continue;
			}
			let parsed: URL;
			try {
				parsed = new URL(rawUrl);
			} catch {
				continue;
			}
			const protocol = parsed.protocol.toLowerCase();
			if (protocol !== 'http:' && protocol !== 'https:') {
				continue;
			}
			const hostname = parsed.hostname.toLowerCase().trim();
			
			if (
				hostname === 'localhost' ||
				hostname === '127.0.0.1' ||
				hostname === '::1'
			) {
				continue;
			}
			
			if (isBlockedIPv6(hostname)) {
				continue;
			}
			
			// Check for IPv4 addresses
			const ipVersion = isIP(hostname);
			if (ipVersion === 4) {
				const octets = hostname.split('.').map(Number);
				if (isPrivateIPv4(octets)) {
					continue;
				}
			}

			const disposition: 'attachment' | 'inline' =
				hv.value?.toLowerCase() === 'inline' ? 'inline' : 'attachment';

			validAttachments.push(
				new RemoteEmailAttachment(filename, parsed.toString(), disposition)
			);
		}
		
		return validAttachments;
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
						name: from?.name ?? context.agent.name,
						address: from?.email ?? this.toEmail(),
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
