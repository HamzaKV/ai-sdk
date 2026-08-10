---
"@varlabs/ai": minor
---

Add `onResponse` to `createAIClient` options: an array of observer hooks `(ctx, output) => void | Promise<void>` that run after a call resolves successfully. For stream calls, the hook sees the not-yet-iterated `AsyncGenerator` (not each chunk) - use the new `usage` `StreamEvent` for per-token accounting, or `ui.core`'s `onChunk` middleware for per-chunk visibility. Additive: the existing pre-call `middleware` option and its `Middleware` type are unchanged.
