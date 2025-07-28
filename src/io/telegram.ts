import { inspect } from 'node:util';
import type { AgentRequest, AgentContext } from '../types';
import { getTracer, recordException } from '../router/router';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import { POST } from '../apis/api';
import { safeStringify } from '../server/util';

type TelegramResponse = {
    message_id: number;
    chat: {
        id: number;
        type: string;
        title?: string;
        username?: string;
        first_name?: string;
        last_name?: string;
    };
    from: {
        id: number;
        is_bot: boolean;
        first_name: string;
        last_name?: string;
        username?: string;
    };
    text: string;
    date: number;
};

/**
 * A reply to a telegram message
 */
export interface TelegramReply {
    /**
     * the text body of the reply
     */
    text: string;
}

/**
 * A class representing a telegram message with the common information so processing can be done on it.
 */
export class Telegram {
    private readonly _message: TelegramResponse;

    constructor(data: TelegramResponse) {
+        if (!data.message_id || !data.chat || !data.from) {
+            throw new Error('Invalid Telegram message: missing required fields');
+        }
        this._message = data;
    }

    [inspect.custom]() {
        return this.toString();
    }

    toString() {
        return JSON.stringify(this._message);
    }

    get messageId(): number {
        return this._message.message_id;
    }

    get chatId(): number {
        return this._message.chat.id;
    }

    get chatType(): string {
        return this._message.chat.type;
    }

    get fromId(): number {
        return this._message.from.id;
    }

    get fromUsername(): string | undefined {
        return this._message.from.username;
    }

    get fromFirstName(): string {
        return this._message.from.first_name;
    }

    get fromLastName(): string | undefined {
        return this._message.from.last_name;
    }

    get text(): string {
-        return this._message.text;
+        return this._message.text || '';
    }

    get date(): number {
        return this._message.date;
    }
}

    private async _sendReply(
        req: AgentRequest,
        ctx: AgentContext,
        options: {
            reply?: string;
            action?: 'typing';
            parseMode?: 'MarkdownV2' | 'HTML';
        } = {}
    ) {
        const tracer = getTracer();
        const currentContext = context.active();

        const authToken = req.metadata?.['telegram-auth-token'] as string;
        if (!authToken) {
            throw new Error(
                'telegram authorization token is required but not found in metadata'
            );
        }
        // Create a child span using the current context
        const span = tracer.startSpan('agentuity.telegram.reply', {}, currentContext);

        try {
            // Create a new context with the child span
            const spanContext = trace.setSpan(currentContext, span);

            // Execute the operation within the new context
            return await context.with(spanContext, async () => {
                span.setAttribute('@agentuity/agentId', ctx.agent.id);
                span.setAttribute('@agentuity/telegramMessageId', this.messageId);
                span.setAttribute('@agentuity/telegramChatId', this.chatId);

                const resp = await POST(
                    '/telegram/reply',
                    safeStringify({
                        chatId: this.chatId,
                        message: options.reply,
                        action: options.action,
                        agentId: ctx.agent.id,
                        parseMode: options.parseMode,
                    }),
                    {
                        'Content-Type': 'application/json',
                        'X-Agentuity-Message-Id': `${this.messageId}`,
                        'X-Agentuity-Chat-Id': `${this.chatId}`,
                    },
                    undefined,
                    authToken
                );
                if (resp.status === 200) {
                    span.setStatus({ code: SpanStatusCode.OK });
                    return;
                }
                throw new Error(
                    `error sending telegram reply: ${resp.response.statusText} (${resp.response.status})`
                );
            });
        } catch (ex) {
            recordException(span, ex);
            throw ex;
        } finally {
            span.end();
        }
    }

    async sendReply(
        req: AgentRequest,
        ctx: AgentContext,
        reply: string,
        options: {
            parseMode?: 'MarkdownV2' | 'HTML';
        } = {}
    ) {
        return this._sendReply(req, ctx, { reply, parseMode: options.parseMode });
    }

    async sendTyping(
        req: AgentRequest,
        ctx: AgentContext,
    ) {
        return this._sendReply(req, ctx, { action: 'typing' });
    }
}

/**
 * Parse a telegram message from a buffer and return a Telegram object.
 */
export async function parseTelegram(data: Buffer): Promise<Telegram> {
    try {
        const msg = JSON.parse(data.toString()) as TelegramResponse;
        return new Telegram(msg);
    } catch (error) {
        throw new Error(
            `Failed to parse telegram message: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}
