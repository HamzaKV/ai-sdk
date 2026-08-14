---
"@varlabs/ai": minor
---

`StreamEvent`'s `client-tool-call` and `hitl-pending` variants gain an optional `siblingResults` field: server-tool calls executed in the same round as the paused/auto-executed client tool call, so a round is never resent half-finished. Additive, non-breaking.
