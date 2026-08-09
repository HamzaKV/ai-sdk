import { defineTool, type ServerTool } from '@varlabs/ai/utils/tool';

export type McpToolDefinition = {
    name: string;
    description?: string;
    inputSchema: Record<string, any>;
};

export type McpClientOptions = {
    url: string;
    headers?: Record<string, string>;
    fetchImpl?: typeof fetch;
};

export type McpClient = {
    listTools(): Promise<McpToolDefinition[]>;
    callTool(
        name: string,
        args: unknown,
    ): Promise<{ content?: unknown; isError?: boolean }>;
    close(): Promise<void>;
};

type JsonRpcMessage = {
    jsonrpc: '2.0';
    id?: number;
    result?: any;
    error?: { code: number; message: string };
};

const parseSseMessages = (text: string): JsonRpcMessage[] => {
    const messages: JsonRpcMessage[] = [];
    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice('data:'.length).trim();
        if (!payload) continue;
        try {
            messages.push(JSON.parse(payload));
        } catch {
            // Skip malformed lines - a single bad chunk shouldn't sink the whole response.
        }
    }
    return messages;
};

// Client for the MCP streamable-HTTP transport: JSON-RPC 2.0 over POST, responses are
// either a single JSON body or an SSE stream carrying JSON-RPC messages.
export const createMcpClient = (options: McpClientOptions): McpClient => {
    const fetchImpl = options.fetchImpl ?? fetch;
    let sessionId: string | undefined;
    let nextId = 0;

    const post = async (body: Record<string, unknown>) => {
        const res = await fetchImpl(options.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json, text/event-stream',
                ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
                ...options.headers,
            },
            body: JSON.stringify(body),
        });

        const returnedSessionId = res.headers.get('Mcp-Session-Id');
        if (returnedSessionId) sessionId = returnedSessionId;

        return res;
    };

    const request = async (method: string, params?: unknown): Promise<any> => {
        const id = ++nextId;
        const res = await post({ jsonrpc: '2.0', id, method, params });

        if (!res.ok) {
            throw new Error(`MCP request failed: ${method} (${res.status})`);
        }

        const contentType = res.headers.get('Content-Type') ?? '';
        const messages = contentType.includes('text/event-stream')
            ? parseSseMessages(await res.text())
            : [(await res.json()) as JsonRpcMessage];

        const message =
            messages.find((m) => m.id === id) ?? messages[messages.length - 1];
        if (!message)
            throw new Error(`MCP request produced no response: ${method}`);
        if (message.error)
            throw new Error(
                `MCP error (${message.error.code}): ${message.error.message}`,
            );
        return message.result;
    };

    const notify = async (method: string, params?: unknown): Promise<void> => {
        await post({ jsonrpc: '2.0', method, params });
    };

    let initialized: Promise<void> | undefined;
    const ensureInitialized = () => {
        if (!initialized) {
            initialized = request('initialize', {
                protocolVersion: '2025-03-26',
                capabilities: {},
                clientInfo: { name: '@varlabs/ai.mcp', version: '0.1.0' },
            }).then(() => notify('notifications/initialized'));
        }
        return initialized;
    };

    return {
        async listTools() {
            await ensureInitialized();
            const result = await request('tools/list');
            return (result?.tools ?? []) as McpToolDefinition[];
        },
        async callTool(name, args) {
            await ensureInitialized();
            return request('tools/call', { name, arguments: args });
        },
        async close() {
            sessionId = undefined;
            initialized = undefined;
        },
    };
};

// Converts a remote MCP server's tools into the SDK's Tool shape (server-located: the
// SDK's own server executes them by calling back out to the MCP server over HTTP).
export const mcpToolsAsSdkTools = async (
    client: McpClient,
): Promise<Record<string, ServerTool<any, unknown>>> => {
    const tools = await client.listTools();
    const sdkTools: Record<string, ServerTool<any, unknown>> = {};

    for (const tool of tools) {
        sdkTools[tool.name] = defineTool({
            name: tool.name,
            description: tool.description ?? '',
            parameters: tool.inputSchema,
            location: 'server',
            execute: async (args: unknown) => {
                const result = await client.callTool(tool.name, args);
                if (result.isError) {
                    throw new Error(
                        `MCP tool "${tool.name}" returned an error`,
                    );
                }
                return result.content;
            },
        });
    }

    return sdkTools;
};
