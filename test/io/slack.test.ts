import { describe, test, expect } from 'bun:test';
import { Slack, parseSlack } from '../../src/io/slack';

describe('Slack IO', () => {
	describe('parseSlack', () => {
		test('should parse slack-event payload correctly', async () => {
			const eventPayload = {
				token: 'test-token',
				team_id: 'T123456',
				api_app_id: 'A123456',
				event: {
					type: 'message',
					event_ts: '1234567890.123456',
				},
				type: 'event_callback',
				event_id: 'Ev12345678',
				event_time: 1234567890,
				authed_users: ['U123456'],
				challenge: 'test-challenge',
			};

			const buffer = Buffer.from(JSON.stringify(eventPayload));
			const slack = await parseSlack(buffer);

			expect(slack.payload.token).toBe('test-token');
			expect(slack.payload.team_id).toBe('T123456');
			expect(slack.payload.api_app_id).toBe('A123456');
			expect(slack.payload.event_id).toBe('Ev12345678');
			expect(slack.payload.event_time).toBe(1234567890);
			expect(slack.payload.authed_users).toEqual(['U123456']);
			expect(slack.payload.challenge).toBe('test-challenge');
			expect(slack.payload.type).toBe('event_callback');
			expect(slack.payload.event.type).toBe('message');
			expect(slack.payload.event.event_ts).toBe('1234567890.123456');
		});



		test('should throw error for invalid slack-event payload', async () => {
			const invalidPayload = {
				// Missing required fields
				type: 'event_callback',
			};

			const buffer = Buffer.from(JSON.stringify(invalidPayload));

			await expect(parseSlack(buffer)).rejects.toThrow(
				'Invalid Slack event: missing required fields'
			);
		});
	});

	describe('Slack class', () => {


		test('should return correct string representation', async () => {
			const eventPayload = {
				token: 'test-token',
				team_id: 'T123456',
				api_app_id: 'A123456',
				event: {
					type: 'url_verification',
					event_ts: '1234567890.123456',
				},
				type: 'event_callback',
				event_id: 'Ev12345678',
				event_time: 1234567890,
				authed_users: ['U123456'],
				challenge: 'test-challenge',
			};

			const buffer = Buffer.from(JSON.stringify(eventPayload));
			const slack = await parseSlack(buffer);

			expect(slack.toString()).toBe(JSON.stringify(eventPayload));
		});

		test('should handle inThread option correctly', () => {
			// Test that SlackReply interface accepts inThread property
			const replyWithThread: import('../../src/io/slack').SlackReply = {
				text: 'Reply in thread',
				inThread: true,
			};

			const replyWithoutThread: import('../../src/io/slack').SlackReply = {
				text: 'Reply not in thread',
				inThread: false,
			};

			const replyWithBlocks: import('../../src/io/slack').SlackReply = {
				blocks: '{"blocks": []}',
				inThread: true,
			};

			expect(replyWithThread.text).toBe('Reply in thread');
			expect(replyWithThread.inThread).toBe(true);
			expect(replyWithoutThread.inThread).toBe(false);
			expect(replyWithBlocks.inThread).toBe(true);
		});
	});
});
