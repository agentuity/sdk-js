---
"@agentuity/sdk": patch
---

Monkey patch console to redirect into otel logger
More improvements on bundling JS
Handle direct return from agent run in case you don't return correct signature
Set the span status on completion for agent run
Add cli version to trace context
More work on agent-to-agent remote comms
