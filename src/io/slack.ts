import { inspect } from 'node:util';
import { SpanStatusCode, context, trace } from '@opentelemetry/api';
import { POST } from '../apis/api';
import { getTracer, recordException } from '../router/router';
import { safeStringify } from '../server/util';
import type { AgentContext, AgentRequest, SlackService } from '../types';

// Standard event wrapper for the Events API based on Slack schema
interface SlackEventData {
	type: string;
	event_ts: string;
	[key: string]: unknown;
}

interface SlackMessageEvent extends SlackEventData {
	type: 'message';
	subtype?: string;
	channel: string;
	channel_type?: 'im' | 'channel' | 'group' | 'mpim';
	user: string;
	text: string;
	ts: string;
	edited?: {
		user: string;
		ts: string;
	};
}

function isSlackMessageEvent(data: SlackEventData): data is SlackMessageEvent {
	return (
		typeof data === 'object' &&
		data !== null &&
		'type' in data &&
		data.type === 'message'
	);
}

// Standard event wrapper payload for Slack Events API
interface SlackEventPayload {
	token: string;
	team_id: string;
	api_app_id: string;
	event: SlackEventData;
	type: string;
	event_id: string;
	event_time: number;
	challenge?: string;
	[key: string]: unknown;
}

/**
 * A reply to a Slack message
 */
export interface SlackReply {
	// The agent ID
	agentId: string;
	// The text to reply with
	text: string;
	// The channel to reply to
	channel: string;
}

export function isSlackEventPayload(data: unknown): data is SlackEventPayload {
	return (
		typeof data === 'object' &&
		data !== null &&
		'token' in data &&
		'team_id' in data &&
		'api_app_id' in data &&
		'event' in data &&
		'type' in data &&
		'event_id' in data &&
		'event_time' in data
	);
}

/**
 * A class representing a Slack event with the common information so processing can be done on it.
 */
export class Slack implements SlackService {
	private readonly eventPayload: SlackEventPayload;

	constructor(data: unknown) {
		console.log(data);
		if (isSlackEventPayload(data)) {
			this.eventPayload = data;
			return;
		}
		throw new Error('Invalid Slack event: missing required fields');
	}

	[inspect.custom]() {
		return this.toString();
	}

	toString() {
		return JSON.stringify(this.eventPayload);
	}

	get _raw(): unknown {
		return this.eventPayload;
	}

	get message(): SlackMessageEvent {
		if (!isSlackMessageEvent(this.eventPayload.event)) {
			throw new Error('Payload is not Slack message');
		}

		return this.eventPayload.event;
	}

	get body(): string {
		return JSON.stringify(this.eventPayload);
	}

	async sendReply(req: AgentRequest, ctx: AgentContext, reply: string) {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan('agentuity.slack.reply', {}, currentContext);

		try {
			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
				span.setAttribute('@agentuity/agentId', ctx.agent.id);
				span.setAttribute('@agentuity/slackTeamId', this.eventPayload.team_id);
				span.setAttribute('@agentuity/slackEventType', this.eventPayload.type);

				if (!isSlackMessageEvent(this.eventPayload.event)) {
					throw new Error('Unsupported reply payload');
				}

				// Create payload matching backend structure
				const payload: SlackReply = {
					agentId: ctx.agent.id,
					text: reply,
					channel: this.eventPayload.event.channel,
				};

				const resp = await POST('/slack/reply', safeStringify(payload), {
					'Content-Type': 'application/json',
					'X-Agentuity-Slack-Team-Id': this.eventPayload.team_id,
				});

				if (resp.status === 200) {
					span.setStatus({ code: SpanStatusCode.OK });
					return;
				}
				throw new Error(
					`error sending slack reply: ${resp.response.statusText} (${resp.response.status})`
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
 * Parse a Slack event payload from a buffer and return a Slack object.
 */
export async function parseSlack(data: Buffer): Promise<Slack> {
	try {
		const payload = JSON.parse(data.toString()) as SlackEventPayload;
		return new Slack(payload);
	} catch (error) {
		throw new Error(
			`Failed to parse slack event: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}
