export interface DiscordMessageI {
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

function isDiscordMessage(message: unknown): message is DiscordMessageI {
	if (typeof message !== 'object') return false;
	if (message === null) return false;
	if (Array.isArray(message)) return false;

	const messageKeys = Object.keys(message);
	if (messageKeys.length !== 6) return false;

	const requiredKeys = ['messageId', 'userId', 'username', 'content'];
	const optionalKeys = ['guildId', 'channelId'];

	const messageKeysSet = new Set(messageKeys);

	for (const key of requiredKeys) {
		if (!messageKeysSet.has(key)) return false;
	}

	return messageKeys.every(
		(key) => requiredKeys.includes(key) || optionalKeys.includes(key)
	);
}

export class DiscordMessage implements DiscordMessageI {
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
