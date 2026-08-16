---
"@varlabs/ai.ui-core": minor
---

`ChatCore` gains `resumeFromJob(jobId)`, rehydrating `messages`/`pendingApproval` from a durable `jobStore` entry - the piece that lets `approve()`/`deny()` work from a fresh `ChatCore` instance (reload, new tab, different device) that didn't itself pause the turn. Rejects if the job isn't found, isn't `pending` (already resolved elsewhere), or a turn is already in flight.
