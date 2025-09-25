# Stream API Example

Here's an example of how to use the new Stream API with the Agentuity SDK:

```typescript
import type { AgentContext, AgentRequest, AgentResponse } from "@agentuity/sdk";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export default async function Agent(
  req: AgentRequest,
  resp: AgentResponse,
  ctx: AgentContext,
) {
  try {
    // Create a new stream with a name and optional metadata
    const stream = await ctx.stream.create("my-stream", {
      metadata: {
        customerId: "customer-123",
        type: "llm-response",
        requestId: ctx.sessionId
      }
    });

    // Use waitUntil to handle background processing without blocking the response
    ctx.waitUntil(async () => {
      const result = streamText({
        model: openai("gpt-4"),
        system: "You are a helpful assistant that provides concise and accurate information.",
        prompt: (await req.data.text()) ?? "Hello, OpenAI",
      });

      // Pipe the LLM stream to the agent's stream
      await result.fullStream.pipeTo(stream);
      
      // Close the stream when done
      stream.close();
    });

    // Return the stream info to the caller immediately
    // The caller can start consuming the stream before it finishes
    // and can read it multiple times using RANGE requests
    return resp.json({
      stream: {
        id: stream.id,
        url: stream.url,
      },
    });
  } catch (error) {
    ctx.logger.error("Error running agent:", error);
    return resp.text("Sorry, there was an error processing your request.");
  }
}
```

## Stream Interface

The `Stream` interface extends `WritableStream` and provides:

- `id: string` - Unique stream identifier
- `url: string` - Unique URL to consume the stream (supports multiple reads and RANGE requests)

## API Signature

```typescript
create(name: string, props?: CreateStreamProps): Promise<Stream>
```

**Parameters:**
- `name: string` - Required stream name (1-254 characters)
- `props?: CreateStreamProps` - Optional properties object

**CreateStreamProps:**
- `metadata?: Record<string,string>` - Optional metadata for filtering and organization in the UI

## Benefits

- **Non-blocking**: Stream creation returns immediately, content generation happens in background
- **Resumable**: Consumers can read streams multiple times
- **Partial reads**: RANGE request support for reading specific portions
- **Metadata**: Rich metadata support for filtering and organization
- **URL-based**: Direct URL access for easy integration
