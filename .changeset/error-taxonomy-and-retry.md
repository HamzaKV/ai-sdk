---
"@varlabs/ai.utils": minor
---

Add `@varlabs/ai.utils/errors` (`AiSdkError`, `classifyProviderError`) and `@varlabs/ai.utils/retry` (`withRetry`). Fully additive and opt-in: `fetch.server`'s `Fetch` still throws exactly what it always has (the provider's raw error body, or a plain `Error` for network/timeout failures) - `classifyProviderError` works directly on that shape rather than requiring a change to what's thrown. Wrap any single provider call with `withRetry(() => ...)` to get exponential-backoff retry on rate-limit/server/network errors; retry policy is a per-call decision, not threaded through provider config.
