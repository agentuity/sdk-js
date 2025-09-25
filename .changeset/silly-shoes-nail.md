---
"@agentuity/sdk": patch
---

Adds the ability to getReader() to return a reader for the Stream
Immediately schedules tasks sent to context.waitUntil instead of waiting until the response is returned
Adds the ability to return a Stream directly from a Agent handler and have it return a 302 with the stream location automatically
