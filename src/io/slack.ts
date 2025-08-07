import { inspect } from 'node:util';
import { SpanStatusCode, context, trace } from '@opentelemetry/api';
import { POST } from '../apis/api';
import { getTracer, recordException } from '../router/router';
import { safeStringify } from '../server/util';
import type { AgentContext, AgentRequest, SlackService } from '../types';

// Event represents the inner event data for Slack events
interface SlackEventData {
	type: string;
	channel: string;
	user: string;
	text: string;
	ts: string;
	event_ts: string;
	channel_type: string;
	thread_ts?: string;
}

// SlackEvent represents a Slack event webhook payload
interface SlackEventPayload {
	token: string;
	challenge: string;
	type: string;
	team_id: string;
	api_app_id: string;
	event?: SlackEventData;
}

// SlackMessage represents a Slack slash command payload
interface SlackMessagePayload {
	token: string;
	team_id: string;
	team_domain: string;
	channel_id: string;
	channel_name: string;
	user_id: string;
	user_name: string;
	command: string;
	text: string;
	response_url: string;
	trigger_id: string;
	ts: string;
	thread_ts?: string;
	event_ts?: string;
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
 * A class representing a Slack message with the common information so processing can be done on it.
 */
export class Slack implements SlackService {
	private readonly _payload: SlackEventPayload | SlackMessagePayload;
	private readonly _messageType: 'slack-event' | 'slack-message';
	private readonly eventPayload?: SlackEventPayload;
	private readonly messagePayload?: SlackMessagePayload;

	constructor(
		data: SlackEventPayload | SlackMessagePayload,
		messageType: 'slack-event' | 'slack-message'
	) {
		if (messageType === 'slack-event') {
			const eventData = data as SlackEventPayload;
			if (!eventData.token || !eventData.type || !eventData.team_id) {
				throw new Error('Invalid Slack event: missing required fields');
			}
			this.eventPayload = eventData;
		} else {
			const messageData = data as SlackMessagePayload;
			if (
				!messageData.token ||
				!messageData.team_id ||
				!messageData.channel_id ||
				!messageData.user_id
			) {
				throw new Error('Invalid Slack message: missing required fields');
			}
			this.messagePayload = messageData;
		}
		this._payload = data;
		this._messageType = messageType;
	}

	[inspect.custom]() {
		return this.toString();
	}

	toString() {
		return JSON.stringify(this._payload);
	}

	get messageType(): 'slack-event' | 'slack-message' {
		return this._messageType;
	}

	get token(): string {
		return this._payload.token;
	}

	get teamId(): string {
		return this._payload.team_id;
	}

	// Properties specific to Slack events
	get challenge(): string | undefined {
		return this.eventPayload?.challenge;
	}

	get eventType(): string | undefined {
		return this.eventPayload?.type;
	}

	get event(): SlackEventData | undefined {
		return this.eventPayload?.event;
	}

	// Properties specific to Slack messages (slash commands)
	get channelId(): string | undefined {
		return this.messagePayload?.channel_id;
	}

	get channelName(): string | undefined {
		return this.messagePayload?.channel_name;
	}

	get userId(): string | undefined {
		return this.messagePayload?.user_id;
	}

	get userName(): string | undefined {
		return this.messagePayload?.user_name;
	}

	get command(): string | undefined {
		return this.messagePayload?.command;
	}

	get responseUrl(): string | undefined {
		return this.messagePayload?.response_url;
	}

	get triggerId(): string | undefined {
		return this.messagePayload?.trigger_id;
	}

	get threadTs(): string | undefined {
		return this.eventPayload?.event?.thread_ts;
	}

	get eventTs(): string | undefined {
		return this.eventPayload?.event?.event_ts;
	}

	get ts(): string | undefined {
		return this.eventPayload?.event?.ts;
	}

	get body(): string | undefined {
		return JSON.stringify(this.eventPayload);
	}

	// Common text getter that works for both types
	get text(): string {
		if (this.eventPayload) {
			return this.event?.text || '';
		}
		return this.messagePayload?.text || '';
	}

	// Common user identifier
	get user(): string {
		if (this.eventPayload) {
			return this.event?.user || '';
		}
		return this.userId || '';
	}

	// Common channel identifier
	get channel(): string {
		if (this.eventPayload) {
			return this.event?.channel || '';
		}
		return this.channelId || '';
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
				span.setAttribute('@agentuity/slackMessageType', this.messageType);

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
					channel: this.channel,
					text: replyObj.text,
					blocks: replyObj.blocks,
					thread_ts: inThread ? threadTS : undefined,
				};

				if (this.channel) {
					span.setAttribute('@agentuity/slackChannel', this.channel);
				}

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
 * Parse a Slack payload from a buffer and return a Slack object.
 * The messageType should be extracted from the metadata before calling this function.
 */
export async function parseSlack(
	data: Buffer,
	messageType: 'slack-event' | 'slack-message'
): Promise<Slack> {
	try {
		const payload = JSON.parse(data.toString()) as
			| SlackEventPayload
			| SlackMessagePayload;
		return new Slack(payload, messageType);
	} catch (error) {
		throw new Error(
			`Failed to parse slack ${messageType}: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}
