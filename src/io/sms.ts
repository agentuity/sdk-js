import { inspect } from "node:util";
import type { AgentRequest, AgentContext } from "../types";
import { getTracer, recordException } from "../router/router";
import { context, trace, SpanStatusCode } from "@opentelemetry/api";
import { POST } from "../apis/api";
import { safeStringify } from "../server/util";

type TwilioResponse = {
    Body: string;
    From: string;
    MessageSid: string;
    To: string;
};

/**
 * A reply to an email
 */
export interface TwilioSmsReply {
    /**
     * the text body of the reply
     */
    text: string;
}

/**
 * A class representing an sms with the common information so processing can be done on it.
 */
export class TwilioSms {
    private readonly _message: TwilioResponse;

    constructor(data: TwilioResponse) {
        this._message = data;
    }

    [inspect.custom]() {
        return this.toString();
    }

    toString() {
        return JSON.stringify(this._message);
    }
    get messageId(): string {
        return this._message.MessageSid;
    }

    get to(): string {
        return this._message.To;
    }
    get from(): string {
        return this._message.From;
    }

    get text(): string {
        return this._message.Body;
    }

    async sendReply(req: AgentRequest, ctx: AgentContext, reply: string) {

        const tracer = getTracer();
        const currentContext = context.active();

        const authToken = req.metadata?.["twilio-auth-token"] as string;
        if (!authToken) {
            throw new Error("twilio authorization token is required but not found in metadata");
        }
        // Create a child span using the current context
        const span = tracer.startSpan("agentuity.twilio.reply", {}, currentContext);

        try {
            // Create a new context with the child span
            const spanContext = trace.setSpan(currentContext, span);

            // Execute the operation within the new context
            return await context.with(spanContext, async () => {
                span.setAttribute("@agentuity/agentId", ctx.agent.id);
                span.setAttribute("@agentuity/twilioMessageId", this.messageId);
                const resp = await POST(
                    "/sms/twilio/reply",
                    safeStringify({
                        from: this.from,
                        to: this.to,
                        reply: reply,
                    }),
                    {
                        "Content-Type": "application/json",
                        "X-Agentuity-Message-Id": this.messageId,
                    },
                    undefined,
                    authToken
                );
                if (resp.status === 200) {
                    span.setStatus({ code: SpanStatusCode.OK });
                    return;
                }
                throw new Error(`error sending email reply: ${resp.response.statusText} (${resp.response.status})`);
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
 * Parse an email from a buffer and return an Email object.
 */
export async function parseSms(data: Buffer): Promise<TwilioSms> {
    try {
        const message = JSON.parse(data.toString()) as TwilioResponse;
        return new TwilioSms(message);
    } catch (error) {
        throw new Error(`Failed to parse sms: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}
