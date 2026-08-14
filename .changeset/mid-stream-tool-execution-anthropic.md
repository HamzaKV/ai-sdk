---
"@varlabs/ai.anthropic": minor
---

`stream()` now executes `location: 'server'` custom tools mid-stream and automatically continues the conversation (re-POSTing with the tool result appended), up to 5 rounds, instead of ending the generator at the first tool call. `location: 'client'` tools now require an explicit `approval: 'auto' | 'required'` field, driving whether the stream emits `client-tool-call` (auto-executed by the caller) or `hitl-pending` (paused for approval) - **breaking**: existing client-tool definitions need this field added.

Also widens `AnthropicMessagesInput`'s message `content` to accept an array of blocks (previously a single block only), needed to replay a multi-block turn (e.g. `tool_use` + `tool_result`) back to the API.

New `./chat-messages` subpath exports `toAnthropicMessages`, translating a `ChatMessage[]`-shaped array back into Anthropic's wire format - the piece that lets a resumed turn (after approve/deny) reconstruct a valid request.
