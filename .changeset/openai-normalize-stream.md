---
"@varlabs/ai.openai": minor
---

`text.stream_response()` now yields the SDK's shared `StreamEvent` protocol directly instead of raw Responses API SSE events - this was the intended design (every provider normalizes its own wire format before yielding) but was never actually wired up. **Breaking**: code consuming the raw event shapes (`response.output_text.delta`, `response.completed`, etc.) needs to switch to `StreamEvent`'s `text-delta`/`reasoning-delta`/`usage`/`error`/`done`, or fetch the raw stream itself and normalize with the newly-exported `mapOpenAiStreamEvent` (`@varlabs/ai.openai/stream-events`) if you need full control.

Not yet covered by the mapper: function_call_arguments events (mid-stream client-tool-call/hitl-pending emission needs argument-delta accumulation and job creation that don't exist at this layer), output items, content parts, annotations, refusals, and built-in tool call progress events.
