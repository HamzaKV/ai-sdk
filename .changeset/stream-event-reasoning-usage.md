---
"@varlabs/ai": minor
---

Extend `StreamEvent` with `reasoning-delta` and `usage` variants. `usage` may be emitted more than once by a given provider mapper, each time with only the fields known at that point in the stream (merge/replace rather than expecting one final total). Additive - existing `StreamEvent` consumers are unaffected.
