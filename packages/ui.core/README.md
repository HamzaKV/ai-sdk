# @varlabs/ai.ui-core

Framework-agnostic chat/stream/tool-call/HITL state machine for the AI SDK, consumed by framework bindings like [`@varlabs/ai.ui-react`](../ui.react).

## Installation
```bash
npm install @varlabs/ai.ui-core
# or
yarn add @varlabs/ai.ui-core
# or
pnpm add @varlabs/ai.ui-core
```

## Usage

`createChatCore` owns message state and turns your provider's stream into UI-ready state updates. You supply `streamFn` - your own provider call, normalized to the SDK's `StreamEvent` stream - and subscribe to state changes:

```typescript
import { createChatCore } from '@varlabs/ai.ui-core';

const chat = createChatCore({
  streamFn: (messages) => myProviderStream(messages),
  clientTools: {
    getWeather: async (args) => fetchWeather(args),
  },
});

const unsubscribe = chat.subscribe((state) => {
  console.log(state.status, state.messages);
});

await chat.sendMessage('What is the weather in Paris?');
```

Tool calls that require human approval surface as `state.pendingApproval`; call `chat.approve()` or `chat.deny(reason)` to resolve them. Durability across reloads comes from an optional `jobStore` (see [`@varlabs/ai.state`](../state)) - if omitted, an in-memory store is used.

This package has no framework dependency. If you're using React, use [`@varlabs/ai.ui-react`](../ui.react)'s `useChat` hook instead of calling `createChatCore` directly.

## License
MIT
