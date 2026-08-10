---
"@varlabs/ai.anthropic": patch
"@varlabs/ai.openai": patch
---

anthropic: fix `thinking` option type (`type: 'enabled'|'disabled'`, was a boolean that the real API rejects), fix `disable_parallel_tool_user` typo (was `disable_parallel_tool_use`, silently ignored by the API), and type `stream()`'s SSE chunks against the real event shapes instead of the non-stream response shape.

openai: fix `repsonse_format` typo in image variations, fix `generate_audio` posting to the nonexistent `/audio/generations` instead of `/audio/speech`, remove a stray dead statement.
