# @varlabs/ai.state

Bring-your-own-backend state persistence adapter for the AI SDK, used for human-in-the-loop (HITL) job/tool-call durability: a paused conversation - awaiting approval before a tool call runs - is stored as a `HitlJob` so it can be resumed from any client/device, at any later time.

## Installation
```bash
npm install @varlabs/ai.state
# or
yarn add @varlabs/ai.state
# or
pnpm add @varlabs/ai.state
```

## Usage

Implement `StatePersistence` against your own backend (Redis, a database, etc.), or use `createInMemoryStatePersistence` for dev/tests:

```typescript
import { createJobStore, createInMemoryStatePersistence } from '@varlabs/ai.state';

const jobStore = createJobStore(createInMemoryStatePersistence());

const job = await jobStore.create({
  id: 'job_1',
  conversationState: messages,
  pendingToolCall: { toolCallId: 'call_1', name: 'sendEmail', args: { to: 'a@b.com' } },
});

// Later, once a human reviews it:
await jobStore.approve(job.id);
// or
await jobStore.deny(job.id, 'not authorized');
```

This package is consumed by `@varlabs/ai.ui-core`'s `createChatCore`, which defaults to an in-memory job store if you don't supply one.

## License
MIT
