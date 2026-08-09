# @varlabs/ai.mcp

MCP client for the AI SDK: connects to remote MCP servers over the streamable-HTTP transport (JSON-RPC 2.0 over POST, with either a single JSON response or an SSE stream) and converts their tools into the SDK's `Tool` definitions.

## Installation
```bash
npm install @varlabs/ai.mcp
# or
yarn add @varlabs/ai.mcp
# or
pnpm add @varlabs/ai.mcp
```

## Usage

```typescript
import { createMcpClient, mcpToolsAsSdkTools } from '@varlabs/ai.mcp';

const client = createMcpClient({ url: 'https://my-mcp-server.example.com/mcp' });

const tools = await mcpToolsAsSdkTools(client);
// tools is a Record<string, ServerTool<any, unknown>> ready to register with the SDK -
// each one calls back out to the MCP server over HTTP when executed.

await client.close();
```

You can also call `client.listTools()` / `client.callTool(name, args)` directly if you want to talk to the MCP server without going through the SDK's tool shape.

## License
MIT
