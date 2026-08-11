# @varlabs/ai.utils

Shared server/client utilities used across the AI SDK's provider packages: timeout-aware fetch wrappers, an error taxonomy for classifying provider failures, and an opt-in retry helper.

## Installation
```bash
npm install @varlabs/ai.utils
# or
yarn add @varlabs/ai.utils
# or
pnpm add @varlabs/ai.utils
```

## Usage

### Fetch wrappers

`fetch.server` and `fetch.client` both add a timeout and JSON parsing on top of the native `fetch`. Use `fetch.server` in Node-like environments (built on `undici`); use `fetch.client` in the browser.

```typescript
import fetchServer from '@varlabs/ai.utils/fetch.server';

const data = await fetchServer('https://api.example.com/thing', {
  method: 'GET',
  MAX_FETCH_TIME: 30000,
});
```

### Error taxonomy

`classifyProviderError` reads the shape a provider call throws (an OpenAI/Anthropic-style `{ type | code, message }` error body, or a plain `Error` for network/timeout failures) into a shared `AiSdkError` with a `kind`: `'rate_limit' | 'auth' | 'context_length' | 'server' | 'network' | 'unknown'`. It doesn't change what providers throw - classify at the call site.

```typescript
import { classifyProviderError } from '@varlabs/ai.utils/errors';

try {
  await client.openai.text.create_response({ /* ... */ });
} catch (err) {
  const classified = classifyProviderError(err);
  if (classified.kind === 'rate_limit') {
    // back off and retry
  }
}
```

### Retry

`withRetry` wraps a single call with exponential-backoff retry, defaulting to retrying `rate_limit`/`server`/`network` errors (via `classifyProviderError`). Retry policy is a per-call decision, not threaded through provider config.

```typescript
import { withRetry } from '@varlabs/ai.utils/retry';

const response = await withRetry(() =>
  client.openai.text.create_response({ /* ... */ }),
);
```

## License
MIT
