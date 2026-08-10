---
"@varlabs/ai": minor
---

`pipeStreamToResponse`'s type signature only accepted a Fetch API `Response`, even though its implementation and its own doc comment ("pipe a stream to Node.js or Web Response objects") already supported a Node `http.ServerResponse`. Widened the parameter type to `Response | NodeWritableResponse` and dropped the unused `T` generic. Callers passing an explicit type argument (`pipeStreamToResponse<Foo, Response>(...)`) will need to drop it - no other change for typical callers.
