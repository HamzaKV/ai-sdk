---
"@varlabs/ai.ui-core": minor
---

`ChatMessage` gains an optional `toolCalls` field, recorded on the assistant message whenever `client-tool-call`/`hitl-pending` is received (including any sibling server-tool results from the same round, appended as their own tool-role messages). Without this, a resumed turn after `approve()`/`deny()` carried only accumulated text, giving providers no way to reconstruct the tool_use/function_call block(s) their wire format requires. Additive, non-breaking.
