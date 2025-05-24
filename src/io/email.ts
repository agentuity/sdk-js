import {
	type Attachment,
	type ParsedMail,
	type Headers,
	simpleParser,
} from 'mailparser';
import { inspect } from 'node:util';

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
		return this._message.attachments ?? [];
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
		throw new Error(`Failed to parse email: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
