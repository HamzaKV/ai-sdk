# @varlabs/ai

A minimal, type-safe toolkit for building multi-model AI applications with standardized, composable interfaces.  
**Runtime-agnostic. Framework-agnostic. Model-agnostic.**

---

## Features

- **Provider Abstraction**  
  Define and compose AI providers (OpenAI, Anthropic, custom, etc.) with a unified, type-safe interface.

- **Custom Providers**  
  Easily create your own providers or install community/third-party providers from npm.

- **Multi-Model Support**  
  Organize and call multiple models (text, image, speech, etc.) under each provider.

- **Type Safety**  
  All model calls and provider definitions are fully typed for maximum safety and IDE support.

- **Middleware**  
  Add cross-cutting logic (logging, auth, rate limiting, etc.) to all model calls via middleware.

- **Streaming Utilities**  
  Handle streaming AI responses (e.g., Server-Sent Events) in a runtime-agnostic way.

- **Minimal & Composable**  
  No runtime dependencies. Designed for easy extension and integration.

- **JS Runtime & Framework Agnostic**  
  Works in Node.js, edge runtimes, serverless, and browsers. No framework assumptions.

---

## Core Concepts

### Provider Definition

Define a provider with models and context (e.g., API keys):

```typescript
import { defineProvider } from '@varlabs/ai/provider';

const myProvider = defineProvider({
  name: 'my-provider',
  context: { config: { apiKey: '...' } },
  models: {
    text: {
      generate: async (input, ctx) => { /* ... */ }
    }
  }
});
```

### Creating a Client

Compose multiple providers and add middleware:

```typescript
import { createAIClient } from '@varlabs/ai';

const client = createAIClient({
  providers: {
    openai: openAIProvider({ config: { apiKey: 'sk-...' } }),
    anthropic: anthropicProvider({ config: { apiKey: 'sk-...' } }),
    // You can also install and use providers from npm:
    // myCustomProvider: require('my-ai-provider')({ config: { ... } }),
  },
  middleware: [
    async (ctx) => { /* e.g., logging, auth */ return true; }
  ]
});

// Usage:
await client.openai.text.generate({ prompt: 'Hello world' });
```

### Middleware

Middleware receives the call context and can block or allow execution:

```typescript
const logger = async (ctx) => {
  console.log('AI call:', ctx.provider, ctx.model, ctx.call);
  return true;
};
```

### Utilities

- **Cosine Similarity**  
  [`cosineSimilarity`](./packages/ai/src/utils/cosine.ts): Compare vector similarity.

- **Streaming**  
  [`handleStreamResponse`](./packages/ai/src/utils/streaming.ts): Parse streaming AI responses (SSE, JSON lines, etc.).  
  [`createDataStream`](./packages/ai/src/utils/streaming.ts): Create a readable stream for streaming data.  
  [`pipeStreamToResponse`](./packages/ai/src/utils/streaming.ts): Pipe a stream to Node.js or Web Response objects.

- **Structure & Tooling**  
  [`defineStructure`](./packages/ai/src/utils/structure.ts): Type-safe schema definition.  
  [`defineTool`](./packages/ai/src/utils/tool.ts): Standardize tool/external function definitions.

---

## Example: Adding a New Provider

You can define your own provider or install one from npm:

```typescript
// Custom provider
const myProvider = defineProvider({
  name: 'custom',
  context: { config: { apiKey: '...' } },
  models: {
    text: {
      generate: async (input, ctx) => {
        // Call your API here
        return { result: '...' };
      }
    }
  }
});

// Or install a provider from npm
import { someProvider } from 'some-ai-provider';
const providerInstance = someProvider({ config: { apiKey: '...' } });
```

---

## Philosophy

- **Minimal surface area:** Only the primitives you need.
- **No runtime lock-in:** Use with any JS runtime or framework.
- **Type safety first:** All interfaces are strongly typed.
- **Composable:** Mix and match providers, models, and middleware.

---

## API Reference

- [`defineProvider`](./packages/ai/src/provider.ts) – Create a provider with models and context.
- [`createAIClient`](./packages/ai/src/index.ts) – Compose providers and middleware into a unified client.
- [`cosineSimilarity`](./packages/ai/src/utils/cosine.ts) – Vector similarity.
- [`handleStreamResponse`](./packages/ai/src/utils/streaming.ts) – Streaming response parser.
- [`createDataStream`](./packages/ai/src/utils/streaming.ts) – Streaming data generator.
- [`pipeStreamToResponse`](./packages/ai/src/utils/streaming.ts) – Pipe streams to responses.
- [`defineStructure`](./packages/ai/src/utils/structure.ts) – Schema definition.
- [`defineTool`](./packages/ai/src/utils/tool.ts) – Tool definition.

---

## License

MIT © Hamza Varvani
