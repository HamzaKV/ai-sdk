# chat-app example

A minimal end-to-end chat app wiring `@varlabs/ai` + `@varlabs/ai.openai` +
`@varlabs/ai.ui-core` + `@varlabs/ai.ui-react` together, streaming real model
output over SSE. Private, not published - exists to be run and read.

## Run it

From the repo root:

```bash
pnpm install
pnpm --filter @varlabs/ai --filter @varlabs/ai.openai --filter @varlabs/ai.ui-core --filter @varlabs/ai.ui-react build
cp examples/chat-app/.env.example examples/chat-app/.env
# put a real key in examples/chat-app/.env
```

Then, in two terminals from `examples/chat-app`:

```bash
pnpm dev:server   # http://localhost:3001 - talks to OpenAI, holds the API key
pnpm dev:client   # http://localhost:5173 - the chat UI, proxies /api to the server above
```

Open http://localhost:5173.

## How it's wired

- `server.ts` - a plain `node:http` server. Calls `client.openai.text.stream_response`,
  maps OpenAI's raw SSE chunks into the SDK's `StreamEvent` protocol with
  `mapToStreamEvents`, and pipes them to the browser with `createDataStream` +
  `pipeStreamToResponse` (both from `@varlabs/ai/utils/streaming`).
- `src/App.tsx` - `useChat` from `ui.react`. Its `streamFn` fetches `/api/chat`
  and reads the SSE response back into `StreamEvent`s with `handleStreamResponse`
  - the same utility the server uses on the way out.
- The API key never reaches the browser; the client only ever talks to `/api/chat`.

Not covered here (see each package's own README): client/server tool calls,
human-in-the-loop approval, file uploads, MCP tools.
