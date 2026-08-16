# @varlabs/ai

## 0.3.0

### Minor Changes

- ba64266: `StreamEvent`'s `client-tool-call` and `hitl-pending` variants gain an optional `siblingResults` field: server-tool calls executed in the same round as the paused/auto-executed client tool call, so a round is never resent half-finished. Additive, non-breaking.

## 0.2.0

### Minor Changes

- a889053: Add `@varlabs/ai/utils/json-schema` (`JsonSchemaParameters`, `InferJsonSchemaParameters`, etc.) - the JSON-Schema-shaped tool-parameter type and its type-level inference, extracted from two byte-identical copies in `provider.anthropic` and `provider.openai`. Both providers now import it instead of redefining it; their own `CustomTool`/`CustomToolBase`/`customTool` stay provider-specific by design (each provider's tool wire shape is deliberately bespoke, not derived from a shared type - see the ai-sdk gap-scan notes). No consumer-visible type change in either provider.
- 9c1e471: `StructureFieldSpec` (used by `defineStructure` and `signatures`' `defineSignature`) now supports `type: 'object'` (nested `properties`) and `type: 'array'` (`items`) fields, recursively, in addition to the existing flat `string`/`number`/`boolean`. `describe()` renders nested fields as an indented list. Additive - existing flat specs and their `describe()`/`parse()` output are unchanged (verified byte-for-byte against the existing test). `parse()` still only validates presence of top-level keys, same as before nesting was added - it was never a deep validator.
- ec7ee89: `pipeStreamToResponse`'s type signature only accepted a Fetch API `Response`, even though its implementation and its own doc comment ("pipe a stream to Node.js or Web Response objects") already supported a Node `http.ServerResponse`. Widened the parameter type to `Response | NodeWritableResponse` and dropped the unused `T` generic. Callers passing an explicit type argument (`pipeStreamToResponse<Foo, Response>(...)`) will need to drop it - no other change for typical callers.
- 56a3c11: Add `onResponse` to `createAIClient` options: an array of observer hooks `(ctx, output) => void | Promise<void>` that run after a call resolves successfully. For stream calls, the hook sees the not-yet-iterated `AsyncGenerator` (not each chunk) - use the new `usage` `StreamEvent` for per-token accounting, or `ui.core`'s `onChunk` middleware for per-chunk visibility. Additive: the existing pre-call `middleware` option and its `Middleware` type are unchanged.
- 482e5cb: Extend `StreamEvent` with `reasoning-delta` and `usage` variants. `usage` may be emitted more than once by a given provider mapper, each time with only the fields known at that point in the stream (merge/replace rather than expecting one final total). Additive - existing `StreamEvent` consumers are unaffected.
