import type { AgentContext, AgentRequest } from '../types';

export interface DiscordMessageInterface {
	/** The Id of the guild the message was sent in if any
	 * Could be undefined if the message was sent in a DM
	 * */
	guildId?: string;

	/** The ID of the channel the message was sent in
	 * */
	channelId: string;

	/** The ID of the message */
	messageId: string;

	/** The ID of the user who sent the message */
	userId: string;

	/** The username of the user who sent the message */
	username: string;

	/** The content of the message */
	content: string;
}

/**
 * Type guard to check if an unknown value is a valid DiscordMessageInterface.
 * Uses a single-loop approach for efficiency:
 * 1. First validates basic object structure
 * 2. Creates a Set of message keys for O(1) lookups
 * 3. Checks that all required keys exist in a single loop
 * 4. Verifies that all keys in the message are either required or optional
 *
 * @param message - The value to check
 * @returns True if the value is a valid DiscordMessageInterface, false otherwise
 */
function isDiscordMessage(
	message: unknown
): message is DiscordMessageInterface {
	if (typeof message !== 'object') return false;
	if (message === null) return false;
	if (Array.isArray(message)) return false;

	const messageKeys = Object.keys(message);
	if (messageKeys.length !== 6) return false;

	// Define required and optional keys for validation
	const requiredKeys = [
		'messageId',
		'channelId',
		'userId',
		'username',
		'content',
	];
	const optionalKeys = ['guildId'];

	// Create a Set for O(1) lookups
	const messageKeysSet = new Set(messageKeys);

	// Check that all required keys exist
	for (const key of requiredKeys) {
		if (!messageKeysSet.has(key)) return false;

		// biome-ignore lint/suspicious/noExplicitAny: Checking valid message type
		if (typeof (message as any)[key] !== 'string') return false;
	}

	// Validate optional guildId if present
	if (
		messageKeysSet.has('guildId') &&
		// biome-ignore lint/suspicious/noExplicitAny: Checking valid message type
		typeof (message as any).guildId !== 'string'
	) {
		return false;
	}

	// Verify all keys in the message are either required or optional
	return messageKeys.every(
		(key) => requiredKeys.includes(key) || optionalKeys.includes(key)
	);
}

/**
 * A reply to a Discord message
 */
export interface DiscordReply {
	/**
	 * The text content of the reply
	 */
	content: string;
}

/**
 * A class representing a Discord message with common information for processing.
 */
export class DiscordMessage implements DiscordMessageInterface {
	private readonly _userId: string;
	private readonly _guildId: string | undefined;
	private readonly _channelId: string;
	private readonly _username: string;
	private readonly _messageId: string;
	private readonly _content: string;

	constructor(message: string) {
		const json = JSON.parse(message);

		if (!isDiscordMessage(json)) {
			throw new Error('Invalid discord message');
		}

		this._userId = json.userId;
		this._guildId = json.guildId;
		this._channelId = json.channelId;
		this._username = json.username;
		this._messageId = json.messageId;
		this._content = json.content;
	}

	get guildId() {
		return this._guildId;
	}

	get channelId() {
		return this._channelId;
	}

	get messageId() {
		return this._messageId;
	}

	get userId() {
		return this._userId;
	}

	get username() {
		return this._username;
	}

	get content() {
		return this._content;
	}

	isDM() {
		return this._guildId === undefined;
	}

	/**
	 * Send a reply to this Discord message
	 *
	 * @param req - The agent request
	 * @param context - The agent context
	 * @param reply - The reply to send
	 * @returns A promise that resolves when the reply is sent
	 */
	async sendReply(
		_req: AgentRequest,
		context: AgentContext,
		reply: DiscordReply
	): Promise<void> {
		// Use the discord service from the context to send the reply
		return context.discord.sendReply(
			context.agent.id,
			this._messageId,
			this._channelId,
			reply.content
		);
	}
}

export async function parseDiscordMessage(
	data: Buffer
): Promise<DiscordMessage> {
	try {
		return new DiscordMessage(data.toString());
	} catch (error) {
		throw new Error(
			`Failed to parse discord: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}
