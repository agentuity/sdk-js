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

// Standard event wrapper payload for Slack Events API
interface SlackEventPayload {
	token: string;
	team_id: string;
	api_app_id: string;
	event: SlackEventData;
	type: string;
	event_id: string;
	event_time: number;
	authed_users: string[];
	challenge?: string;
	[key: string]: unknown;
}



/**
 * A reply to a Slack message
 */
export interface SlackReply {
	/**
	 * the text body of the reply
	 */
	text?: string;
	/**
	 * Slack blocks for rich formatting
	 */
	blocks?: string;
	/**
	 * whether to reply in thread (defaults to true if thread-ts is available in metadata)
	 */
	inThread?: boolean;
}

/**
 * A class representing a Slack event with the common information so processing can be done on it.
 */
export class Slack implements SlackService {
	private readonly eventPayload: SlackEventPayload;

	constructor(data: SlackEventPayload) {
		if (
			!data.token ||
			!data.team_id ||
			!data.api_app_id ||
			!data.event ||
			!data.type ||
			!data.event_id ||
			typeof data.event_time !== 'number' ||
			!Array.isArray(data.authed_users)
		) {
			throw new Error('Invalid Slack event: missing required fields');
		}
		this.eventPayload = data;
	}

	[inspect.custom]() {
		return this.toString();
	}

	toString() {
		return JSON.stringify(this.eventPayload);
	}

	get token(): string {
		return this.eventPayload.token;
	}

	get teamId(): string {
		return this.eventPayload.team_id;
	}

	get challenge(): string | undefined {
		return this.eventPayload.challenge;
	}

	get eventType(): string {
		return this.eventPayload.type;
	}

	get event(): SlackEventData {
		return this.eventPayload.event;
	}

	get eventId(): string {
		return this.eventPayload.event_id;
	}

	get eventTime(): number {
		return this.eventPayload.event_time;
	}

	get authedUsers(): string[] {
		return this.eventPayload.authed_users;
	}

	get apiAppId(): string {
		return this.eventPayload.api_app_id;
	}

	get eventTs(): string {
		return this.event.event_ts;
	}

	get body(): string {
		return JSON.stringify(this.eventPayload);
	}

	async sendReply(
		req: AgentRequest,
		ctx: AgentContext,
		reply: string | SlackReply
	) {
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
				span.setAttribute('@agentuity/slackTeamId', this.teamId);
				span.setAttribute('@agentuity/slackEventType', this.eventType);

				// Normalize reply to SlackReply object
				const replyObj: SlackReply =
					typeof reply === 'string' ? { text: reply } : reply;

				// Get thread timestamp from metadata
				const threadTS = req.metadata?.['thread-ts'] as string | undefined;

				// Default inThread to true if thread-ts is available in metadata
				const inThread = replyObj.inThread ?? threadTS !== undefined;

				// Create payload matching backend structure
				const payload = {
					agentId: ctx.agent.id,
					text: replyObj.text,
					blocks: replyObj.blocks,
					thread_ts: inThread ? threadTS : undefined,
				};

				const resp = await POST('/slack/reply', safeStringify(payload), {
					'Content-Type': 'application/json',
					'X-Agentuity-Slack-Team-Id': this.teamId,
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
