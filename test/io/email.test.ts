import { describe, it, expect, beforeEach } from 'bun:test';
import { parseEmail, Email } from '../../src/io/email';
import { setupTestEnvironment } from '../setup';

describe('Email Attachment Parsing', () => {
	beforeEach(() => {
		setupTestEnvironment();
	});

	it('should handle normal email attachments with proper content-disposition', async () => {
		const emailContent = `From: test@example.com
To: recipient@example.com
Subject: Test Email with Attachment
Content-Type: multipart/mixed; boundary="boundary123"

--boundary123
Content-Type: text/plain

This is the email body.

--boundary123
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="test.txt"; url="https://example.com/attachment/123"

Test attachment content
--boundary123--
`;

		const email = await parseEmail(Buffer.from(emailContent));
		const attachments = email.attachments();
		
		expect(attachments).toHaveLength(1);
		expect(attachments[0].filename).toBe('test.txt');
	});

	it('should handle Slack-formatted filename without url parameter', async () => {
		const slackFilename = '<http://google.com|google.com>!<http://agentuity.com|agentuity.com>!1751328000!1751414399.zip';
		const emailContent = `From: test@example.com
To: recipient@example.com
Subject: Test Email with Slack Attachment
Content-Type: multipart/mixed; boundary="boundary123"

--boundary123
Content-Type: text/plain

This is the email body.

--boundary123
Content-Type: application/zip
Content-Disposition: attachment; filename="${slackFilename}"

Test attachment content
--boundary123--
`;

		const email = await parseEmail(Buffer.from(emailContent));
		
		expect(() => email.attachments()).not.toThrow();
		const attachments = email.attachments();
		expect(attachments).toHaveLength(0);
	});

	it('should handle malformed content-disposition headers gracefully', async () => {
		const emailContent = `From: test@example.com
To: recipient@example.com
Subject: Test Email with Malformed Attachment
Content-Type: multipart/mixed; boundary="boundary123"

--boundary123
Content-Type: text/plain

This is the email body.

--boundary123
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="test.txt"

Test attachment content
--boundary123--
`;

		const email = await parseEmail(Buffer.from(emailContent));
		
		expect(() => email.attachments()).not.toThrow();
		const attachments = email.attachments();
		expect(attachments).toHaveLength(0);
	});

	it('should filter out attachments without url while keeping valid ones', async () => {
		const emailContent = `From: test@example.com
To: recipient@example.com
Subject: Test Email with Mixed Attachments
Content-Type: multipart/mixed; boundary="boundary123"

--boundary123
Content-Type: text/plain

This is the email body.

--boundary123
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="valid.txt"; url="https://example.com/attachment/123"

Valid attachment content
--boundary123
Content-Type: application/zip
Content-Disposition: attachment; filename="invalid.zip"

Invalid attachment content
--boundary123--
`;

		const email = await parseEmail(Buffer.from(emailContent));
		const attachments = email.attachments();
		
		expect(attachments).toHaveLength(1);
		expect(attachments[0].filename).toBe('valid.txt');
	});

	it('should throw error for missing filename', async () => {
		const emailContent = `From: test@example.com
To: recipient@example.com
Subject: Test Email with Missing Filename
Content-Type: multipart/mixed; boundary="boundary123"

--boundary123
Content-Type: text/plain

This is the email body.

--boundary123
Content-Type: application/octet-stream
Content-Disposition: attachment; url="https://example.com/attachment/123"

Attachment without filename
--boundary123--
`;

		const email = await parseEmail(Buffer.from(emailContent));
		
		expect(() => email.attachments()).toThrow('Invalid attachment headers: missing filename');
	});
});
