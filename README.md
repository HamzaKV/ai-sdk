# ai-sdk

A minimal, type-safe toolkit for building multi-model AI applications with standardized, composable interfaces. Runtime-agnostic, framework-agnostic, model-agnostic.

This is a pnpm workspace monorepo. Each package publishes independently to npm under the `@varlabs` scope.

## Packages

| Package | Description |
|---|---|
| [`@varlabs/ai`](./packages/ai) | Core: `createAIClient`, `defineProvider`, streaming/structure/tool utilities |
| [`@varlabs/ai.anthropic`](./packages/provider.anthropic) | Anthropic provider |
| [`@varlabs/ai.openai`](./packages/provider.openai) | OpenAI provider |
| [`@varlabs/ai.utils`](./packages/utils) | Timeout-aware fetch wrappers used across provider packages |
| [`@varlabs/ai.evals`](./packages/evals) | Dataset regression evals: pluggable scorers that compose with your own vitest suite |
| [`@varlabs/ai.signatures`](./packages/signatures) | DSPy/ax-style typed signatures and a ReAct agent loop |
| [`@varlabs/ai.mcp`](./packages/mcp) | MCP client: connects to remote MCP servers and converts their tools into SDK tools |
| [`@varlabs/ai.state`](./packages/state) | Bring-your-own-backend state persistence for HITL job/tool-call durability |
| [`@varlabs/ai.file-storage`](./packages/file-storage) | Bring-your-own-backend file storage for the upload-then-reference attachment flow |
| [`@varlabs/ai.ui-core`](./packages/ui.core) | Framework-agnostic chat/stream/tool-call/HITL state machine |
| [`@varlabs/ai.ui-react`](./packages/ui.react) | React hooks binding for `ui-core`: `useChat`, file upload, schema-driven forms |

## Quickstart

```bash
pnpm install @varlabs/ai @varlabs/ai.openai
```

```typescript
import { createAIClient } from '@varlabs/ai';
import openAiProvider from '@varlabs/ai.openai';

const client = createAIClient({
  providers: {
    openai: openAiProvider({ config: { apiKey: 'your-api-key' } }),
  },
});

const response = await client.openai.text.create_response({
  model: 'gpt-4o',
  input: 'Tell me a joke about programming.',
});
```

See each package's README (linked above) for its full API. [`@varlabs/ai`](./packages/ai/README.md) covers provider definition, middleware, and streaming/structure/tool utilities in more depth.

## Development

This is a pnpm workspace. See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup, scripts, and the release process.

## License

MIT © Hamza Varvani
