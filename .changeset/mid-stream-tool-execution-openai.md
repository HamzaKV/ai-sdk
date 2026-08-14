---
"@varlabs/ai.openai": minor
---

`stream_response()` now executes `location: 'server'` custom tools mid-stream and automatically continues via `previous_response_id` plus a minimal `function_call_output` input (falling back to replaying the full input array when `store: false`, since `previous_response_id` only resolves against a stored response), up to 5 rounds, instead of ending the generator at the first tool call. `location: 'client'` tools now require an explicit `approval: 'auto' | 'required'` field, driving whether the stream emits `client-tool-call` (auto-executed by the caller) or `hitl-pending` (paused for approval) - **breaking**: existing client-tool definitions need this field added.

New `./chat-messages` subpath exports `toOpenAiInput`, translating a `ChatMessage[]`-shaped array back into the Responses API's `input` array - the piece that lets a resumed turn (after approve/deny) reconstruct a valid request.
