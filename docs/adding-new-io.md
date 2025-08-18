## Generic IO Integration Guide

This guide explains how to add a new IO integration (any messaging or events platform) to the SDK. It focuses on:
- minimal required pieces (types, parser, domain object)
- optional custom actions exposed on the request object (reply, react, typing, etc.)
- telemetry, routing metadata, transport alignment, and tests

Notes:
- Not every integration needs a `sendReply`. Custom actions are optional and platform-specific. For example, you might add `react(emoji)`, `sendTyping()`, `openModal()`, or others.
- Use the smallest viable interface for your platform, then grow as needed.

### 1) Extend core types (required)

Add a new trigger and a `Data` accessor for your integration. Optionally add a service interface and context handle if you want a shared service.

```ts
// src/types.ts
export type TriggerType =
  | 'webhook'
  | 'cron'
  | 'manual'
  | 'agent'
  | 'sms'
  | 'queue'
  | 'voice'
  | 'email'
  | 'discord'
  | 'telegram'
  | 'slack'
  | 'your-io'; // <- add your trigger key

// Optional: define a service interface if you want to expose shared actions
export interface YourIOService {
  // Example action: reply (entirely optional)
  sendReply?(
    req: AgentRequest,
    ctx: AgentContext,
    reply: string | { text?: string }
  ): Promise<void>;

  // Example action: react (entirely optional)
  react?(
    req: AgentRequest,
    ctx: AgentContext,
    emoji: string
  ): Promise<void>;
}

export interface AgentContext {
  // ...
  slack: SlackService;
  yourio?: YourIOService; // <- optional
}

export interface Data {
  // ...
  yourio(): Promise<YourIO>; // <- add
}
```

### 2) Implement the IO domain object and optional custom actions

Create a minimal domain object that wraps the incoming payload and exposes convenient getters. Add any custom actions you want (reply, react, typing, etc.).

```ts
// src/io/yourio.ts
import { inspect } from 'node:util';
import { SpanStatusCode, context, trace } from '@opentelemetry/api';
import { POST } from '../apis/api';
import { getTracer, recordException } from '../router/router';
import { safeStringify } from '../server/util';
import type { AgentContext, AgentRequest, YourIOService } from '../types';

interface YourIOEvent { /* id, channelId, userId, text, ts, threadTs?, ... */ }
interface YourIOPayload { /* webhook payload shape */ }

export interface YourIOReply { text?: string }

export class YourIO implements YourIOService {
  constructor(private payload: YourIOPayload) {}

  get tenantId(): string { /* derive from payload */ return ''; }
  get channel(): string { /* derive channel */ return ''; }
  get text(): string { /* derive text */ return ''; }

  [inspect.custom]() { return this.toString(); }
  toString() { return JSON.stringify(this.payload); }

  // Optional: custom action - reply
  async sendReply(req: AgentRequest, ctx: AgentContext, reply: string | YourIOReply) {
    const tracer = getTracer();
    const span = tracer.startSpan('agentuity.yourio.reply', {}, context.active());
    try {
      const replyObj = typeof reply === 'string' ? { text: reply } : reply;

      const payload = {
        agentId: ctx.agent.id,
        channel: this.channel,
        text: replyObj.text,
        // thread_ts: req.metadata?.['thread-ts']
      };

      const resp = await POST('/yourio/reply', safeStringify(payload), {
        'Content-Type': 'application/json',
        'X-Agentuity-YourIO-Tenant-Id': this.tenantId, // align with backend
      });

      if (resp.status === 200) {
        span.setStatus({ code: SpanStatusCode.OK });
        return;
      }
      throw new Error(`error sending yourio reply: ${resp.response.statusText} (${resp.response.status})`);
    } catch (ex) {
      recordException(span, ex);
      throw ex;
    } finally {
      span.end();
    }
  }

  // Optional: custom action - react
  async react(req: AgentRequest, ctx: AgentContext, emoji: string) {
    const tracer = getTracer();
    const span = tracer.startSpan('agentuity.yourio.react', {}, context.active());
    try {
      const payload = { agentId: ctx.agent.id, channel: this.channel, emoji };
      const resp = await POST('/yourio/react', safeStringify(payload), {
        'Content-Type': 'application/json',
        'X-Agentuity-YourIO-Tenant-Id': this.tenantId,
      });
      if (resp.status === 200) { span.setStatus({ code: SpanStatusCode.OK }); return; }
      throw new Error(`error sending yourio reaction: ${resp.response.statusText} (${resp.response.status})`);
    } catch (ex) {
      recordException(span, ex);
      throw ex;
    } finally { span.end(); }
  }
}

export async function parseYourIO(data: Buffer): Promise<YourIO> {
  const payload = JSON.parse(data.toString()) as YourIOPayload;
  return new YourIO(payload);
}
```

Notes:
- Keep span names and attributes consistent across IOs (`agentuity.yourio.*`).
- Align endpoints and headers with your backend (`/yourio/reply`, `/yourio/react`, etc.).

### 3) Wire Data parsing (required)

Add a `yourio()` parser to the `DataHandler` similar to `slack()`.

```ts
// src/router/data.ts
import { parseYourIO, type YourIO } from '../io/yourio';

export class DataHandler implements Data {
  // ...
  async yourio(): Promise<YourIO> {
    if (this.contentType !== 'application/json') {
      throw new Error('The content type is not a valid yourio message');
    }
    const data = await this.data();
    return parseYourIO(data);
  }
}
```

If your integration has multiple message types (e.g. events vs commands), pass a discriminator from request metadata (`req.metadata['msg-type']`) into your `parseYourIO` and model that in your IO class.

### 4) Expose a service on context (optional)

If you want a shared service, provide a `YourIOService` on `context.yourio`. If your custom actions are implemented directly on the domain object, the service can be omitted entirely.

### 5) Routing metadata conventions

Reuse established conventions:
- `metadata['msg-type']`: discriminator for webhook subtypes if needed.
- `metadata['thread-ts']`: if threads are supported (map to Teams equivalents).

### 6) Telemetry consistency

- Start spans with stable names: `agentuity.yourio.reply`, `agentuity.yourio.react`, etc.
- Add attributes mirroring other IOs: `@agentuity/agentId`, `@agentuity/yourioTenantId`, `@agentuity/yourioMessageType` (if applicable), `@agentuity/yourioChannel`.
- Use `recordException(span, ex)` in catch and `span.setStatus({ code: SpanStatusCode.OK })` on success.

### 7) Tests

Model tests on Slack/Discord tests:
- Parsing: validates `parseYourIO` handles representative payload(s).
- Custom actions: mock transport and assert endpoint, headers, payload, and span behavior.

```ts
// test/io/yourio.test.ts (sketch)
import { parseYourIO } from '../../src/io/yourio';
// ...
```

### 8) Agent usage

Agents access the IO via `req.data.yourio()` and can call your custom actions on the parsed object (or via `context.yourio` if exposed).

```ts
// inside your agent handler
const yourio = await req.data.yourio();
await yourio.sendReply?.(req, ctx, { text: 'Hello from Agentuity' });
await yourio.react?.(req, ctx, '👍');
```

### 9) Minimal check-list

- Types: `TriggerType`, `Data.yourio()`, optional `YourIOService` and `AgentContext.yourio`
- IO: `src/io/yourio.ts` with parser and optional custom actions (reply/react/etc.)
- Router: `DataHandler.yourio()` implementation
- Transport: backend endpoint + headers aligned
- Telemetry: span naming/attributes consistent
- Tests: parsing and custom actions behavior

---

### Step-by-step build

1. Add `'your-io'` to `TriggerType`; add `yourio(): Promise<YourIO>` to `Data`. Optionally define `YourIOService` and add `yourio?: YourIOService` to `AgentContext`.
2. Create `src/io/yourio.ts`: define payload types, implement `class YourIO` with getters and any custom actions you need (reply, react, typing), and `parseYourIO(Buffer) => YourIO`.
3. Wire `DataHandler.yourio()` in `src/router/data.ts` to call `parseYourIO` with content-type validation and any needed metadata discriminators.
4. Implement transport calls inside your custom actions and align headers/endpoints with your backend.
5. Add telemetry for each action: span name, attributes, success status, and exception recording.
6. Write tests for parsing and each custom action (mock the transport).
7. Use it in an agent via `const yourio = await req.data.yourio();` and call the actions you exposed.

