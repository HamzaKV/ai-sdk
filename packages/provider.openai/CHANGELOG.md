# @varlabs/ai.openai

## 0.3.0

### Minor Changes

- ba64266: `stream_response()` now executes `location: 'server'` custom tools mid-stream and automatically continues via `previous_response_id` plus a minimal `function_call_output` input (falling back to replaying the full input array when `store: false`, since `previous_response_id` only resolves against a stored response), up to 5 rounds, instead of ending the generator at the first tool call. `location: 'client'` tools now require an explicit `approval: 'auto' | 'required'` field, driving whether the stream emits `client-tool-call` (auto-executed by the caller) or `hitl-pending` (paused for approval) - **breaking**: existing client-tool definitions need this field added.

  New `./chat-messages` subpath exports `toOpenAiInput`, translating a `ChatMessage[]`-shaped array back into the Responses API's `input` array - the piece that lets a resumed turn (after approve/deny) reconstruct a valid request.

### Patch Changes

- Updated dependencies [ba64266]
  - @varlabs/ai@0.3.0

## 0.2.0

### Minor Changes

- 2b3ed3c: `text.stream_response()` now yields the SDK's shared `StreamEvent` protocol directly instead of raw Responses API SSE events - this was the intended design (every provider normalizes its own wire format before yielding) but was never actually wired up. **Breaking**: code consuming the raw event shapes (`response.output_text.delta`, `response.completed`, etc.) needs to switch to `StreamEvent`'s `text-delta`/`reasoning-delta`/`usage`/`error`/`done`, or fetch the raw stream itself and normalize with the newly-exported `mapOpenAiStreamEvent` (`@varlabs/ai.openai/stream-events`) if you need full control.

  Not yet covered by the mapper: function_call_arguments events (mid-stream client-tool-call/hitl-pending emission needs argument-delta accumulation and job creation that don't exist at this layer), output items, content parts, annotations, refusals, and built-in tool call progress events.

### Patch Changes

- a889053: Add `@varlabs/ai/utils/json-schema` (`JsonSchemaParameters`, `InferJsonSchemaParameters`, etc.) - the JSON-Schema-shaped tool-parameter type and its type-level inference, extracted from two byte-identical copies in `provider.anthropic` and `provider.openai`. Both providers now import it instead of redefining it; their own `CustomTool`/`CustomToolBase`/`customTool` stay provider-specific by design (each provider's tool wire shape is deliberately bespoke, not derived from a shared type - see the ai-sdk gap-scan notes). No consumer-visible type change in either provider.
- ec7ee89: anthropic: fix `thinking` option type (`type: 'enabled'|'disabled'`, was a boolean that the real API rejects), fix `disable_parallel_tool_user` typo (was `disable_parallel_tool_use`, silently ignored by the API), and type `stream()`'s SSE chunks against the real event shapes instead of the non-stream response shape.

  openai: fix `repsonse_format` typo in image variations, fix `generate_audio` posting to the nonexistent `/audio/generations` instead of `/audio/speech`, remove a stray dead statement.

- Updated dependencies [a889053]
- Updated dependencies [37a1059]
- Updated dependencies [9c1e471]
- Updated dependencies [ec7ee89]
- Updated dependencies [56a3c11]
- Updated dependencies [482e5cb]
  - @varlabs/ai@0.2.0
  - @varlabs/ai.utils@1.1.0
