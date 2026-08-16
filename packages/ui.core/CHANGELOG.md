# @varlabs/ai.ui-core

## 0.2.0

### Minor Changes

- 431465b: `ChatCore` gains `resumeFromJob(jobId)`, rehydrating `messages`/`pendingApproval` from a durable `jobStore` entry - the piece that lets `approve()`/`deny()` work from a fresh `ChatCore` instance (reload, new tab, different device) that didn't itself pause the turn. Rejects if the job isn't found, isn't `pending` (already resolved elsewhere), or a turn is already in flight.
- ba64266: `ChatMessage` gains an optional `toolCalls` field, recorded on the assistant message whenever `client-tool-call`/`hitl-pending` is received (including any sibling server-tool results from the same round, appended as their own tool-role messages). Without this, a resumed turn after `approve()`/`deny()` carried only accumulated text, giving providers no way to reconstruct the tool_use/function_call block(s) their wire format requires. Additive, non-breaking.

### Patch Changes

- Updated dependencies [ba64266]
  - @varlabs/ai@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [a889053]
- Updated dependencies [9c1e471]
- Updated dependencies [ec7ee89]
- Updated dependencies [56a3c11]
- Updated dependencies [482e5cb]
  - @varlabs/ai@0.2.0
