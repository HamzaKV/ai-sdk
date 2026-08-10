---
"@varlabs/ai.anthropic": minor
---

`stream()` now yields the SDK's shared `StreamEvent` protocol directly instead of raw Anthropic SSE events - this was the intended design (every provider normalizes its own wire format before yielding) but was never actually wired up. **Breaking**: code consuming `stream()`'s raw event shapes (`message_start`, `content_block_delta`, etc.) needs to switch to `StreamEvent`'s `text-delta`/`reasoning-delta`/`usage`/`error`/`done`, or fetch the raw stream itself and normalize with the newly-exported `mapAnthropicStreamEvent` (`@varlabs/ai.anthropic/stream-events`) if you need full control.

Not yet covered by the mapper: tool_use content blocks (mid-stream client-tool-call/hitl-pending emission needs argument-delta accumulation and job creation that don't exist at this layer), citations, and redacted-thinking content.
