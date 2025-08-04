import { describe, test, expect } from 'bun:test';
import { Slack, parseSlack } from '../../src/io/slack';

describe('Slack IO', () => {
    describe('parseSlack', () => {
        test('should parse slack-event payload correctly', async () => {
            const eventPayload = {
                token: 'test-token',
                challenge: 'test-challenge',
                type: 'event_callback',
                team_id: 'T123456',
                api_app_id: 'A123456',
                event: {
                    type: 'message',
                    channel: 'C123456',
                    user: 'U123456',
                    text: 'Hello, world!',
                    ts: '1234567890.123456',
                    event_ts: '1234567890.123456',
                    channel_type: 'channel'
                }
            };

            const buffer = Buffer.from(JSON.stringify(eventPayload));
            const slack = await parseSlack(buffer, 'slack-event');

            expect(slack.messageType).toBe('slack-event');
            expect(slack.token).toBe('test-token');
            expect(slack.teamId).toBe('T123456');
            expect(slack.challenge).toBe('test-challenge');
            expect(slack.eventType).toBe('event_callback');
            expect(slack.text).toBe('Hello, world!');
            expect(slack.user).toBe('U123456');
            expect(slack.channel).toBe('C123456');
        });

        test('should parse slack-message payload correctly', async () => {
            const messagePayload = {
                token: 'test-token',
                team_id: 'T123456',
                team_domain: 'test-team',
                channel_id: 'C123456',
                channel_name: 'general',
                user_id: 'U123456',
                user_name: 'testuser',
                command: '/test',
                text: 'command argument',
                response_url: 'https://hooks.slack.com/commands/1234/5678',
                trigger_id: '123456.789.abcdef'
            };

            const buffer = Buffer.from(JSON.stringify(messagePayload));
            const slack = await parseSlack(buffer, 'slack-message');

            expect(slack.messageType).toBe('slack-message');
            expect(slack.token).toBe('test-token');
            expect(slack.teamId).toBe('T123456');
            expect(slack.channelId).toBe('C123456');
            expect(slack.channelName).toBe('general');
            expect(slack.userId).toBe('U123456');
            expect(slack.userName).toBe('testuser');
            expect(slack.command).toBe('/test');
            expect(slack.text).toBe('command argument');
            expect(slack.responseUrl).toBe('https://hooks.slack.com/commands/1234/5678');
            expect(slack.triggerId).toBe('123456.789.abcdef');
            expect(slack.user).toBe('U123456');
            expect(slack.channel).toBe('C123456');
        });

        test('should throw error for invalid slack-event payload', async () => {
            const invalidPayload = {
                // Missing required fields
                type: 'event_callback'
            };

            const buffer = Buffer.from(JSON.stringify(invalidPayload));
            
            await expect(parseSlack(buffer, 'slack-event')).rejects.toThrow('Invalid Slack event: missing required fields');
        });

        test('should throw error for invalid slack-message payload', async () => {
            const invalidPayload = {
                // Missing required fields
                command: '/test'
            };

            const buffer = Buffer.from(JSON.stringify(invalidPayload));
            
            await expect(parseSlack(buffer, 'slack-message')).rejects.toThrow('Invalid Slack message: missing required fields');
        });
    });

    describe('Slack class', () => {
        test('should handle slack-event without event data', async () => {
            const eventPayload = {
                token: 'test-token',
                challenge: 'test-challenge',
                type: 'url_verification',
                team_id: 'T123456',
                api_app_id: 'A123456'
                // No event property
            };

            const buffer = Buffer.from(JSON.stringify(eventPayload));
            const slack = await parseSlack(buffer, 'slack-event');

            expect(slack.text).toBe('');
            expect(slack.user).toBe('');
            expect(slack.channel).toBe('');
            expect(slack.event).toBeUndefined();
        });

        test('should handle slack-message with empty text', async () => {
            const messagePayload = {
                token: 'test-token',
                team_id: 'T123456',
                team_domain: 'test-team',
                channel_id: 'C123456',
                channel_name: 'general',
                user_id: 'U123456',
                user_name: 'testuser',
                command: '/test',
                text: '',
                response_url: 'https://hooks.slack.com/commands/1234/5678',
                trigger_id: '123456.789.abcdef'
            };

            const buffer = Buffer.from(JSON.stringify(messagePayload));
            const slack = await parseSlack(buffer, 'slack-message');

            expect(slack.text).toBe('');
        });

        test('should return correct string representation', async () => {
            const eventPayload = {
                token: 'test-token',
                challenge: 'test-challenge',
                type: 'event_callback',
                team_id: 'T123456',
                api_app_id: 'A123456'
            };

            const buffer = Buffer.from(JSON.stringify(eventPayload));
            const slack = await parseSlack(buffer, 'slack-event');

            expect(slack.toString()).toBe(JSON.stringify(eventPayload));
        });

        test('should handle inThread option correctly', () => {
            // Test that SlackReply interface accepts inThread property
            const replyWithThread: import('../../src/io/slack').SlackReply = {
                text: 'Reply in thread',
                inThread: true
            };

            const replyWithoutThread: import('../../src/io/slack').SlackReply = {
                text: 'Reply not in thread',
                inThread: false
            };

            const replyWithBlocks: import('../../src/io/slack').SlackReply = {
                blocks: '{"blocks": []}',
                inThread: true
            };

            expect(replyWithThread.text).toBe('Reply in thread');
            expect(replyWithThread.inThread).toBe(true);
            expect(replyWithoutThread.inThread).toBe(false);
            expect(replyWithBlocks.inThread).toBe(true);
        });
    });
});
