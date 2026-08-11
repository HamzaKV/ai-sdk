---
"@varlabs/ai": minor
---

`StructureFieldSpec` (used by `defineStructure` and `signatures`' `defineSignature`) now supports `type: 'object'` (nested `properties`) and `type: 'array'` (`items`) fields, recursively, in addition to the existing flat `string`/`number`/`boolean`. `describe()` renders nested fields as an indented list. Additive - existing flat specs and their `describe()`/`parse()` output are unchanged (verified byte-for-byte against the existing test). `parse()` still only validates presence of top-level keys, same as before nesting was added - it was never a deep validator.
