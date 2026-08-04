import { describe, it, expect, vi } from 'vitest';
import { createMcpClient, mcpToolsAsSdkTools } from './index';

const jsonResponse = (body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...headers },
    });

const sseResponse = (messages: unknown[], headers: Record<string, string> = {}) => {
    const body = messages.map((m) => `data: ${JSON.stringify(m)}\n\n`).join('');
    return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', ...headers },
    });
};

describe('createMcpClient', () => {
    it('initializes before listing tools and returns the parsed tool list', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 1, result: { serverInfo: {} } }))
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', result: {} })) // notifications/initialized (no id echoed back, but we don't read it)
            .mockResolvedValueOnce(jsonResponse({
                jsonrpc: '2.0',
                id: 2,
                result: { tools: [{ name: 'getWeather', description: 'Get weather', inputSchema: { type: 'object', properties: {} } }] },
            }));

        const client = createMcpClient({ url: 'https://mcp.example.com', fetchImpl });
        const tools = await client.listTools();

        expect(tools).toEqual([
            { name: 'getWeather', description: 'Get weather', inputSchema: { type: 'object', properties: {} } },
        ]);
        expect(fetchImpl).toHaveBeenCalledTimes(3);

        const [initCall, notifyCall, listCall] = fetchImpl.mock.calls;
        expect(JSON.parse(initCall[1].body).method).toBe('initialize');
        expect(JSON.parse(notifyCall[1].body).method).toBe('notifications/initialized');
        expect(JSON.parse(listCall[1].body).method).toBe('tools/list');
    });

    it('only initializes once across multiple calls', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 1, result: {} }))
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', result: {} }))
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 2, result: { tools: [] } }))
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 3, result: { content: 'ok' } }));

        const client = createMcpClient({ url: 'https://mcp.example.com', fetchImpl });
        await client.listTools();
        await client.callTool('noop', {});

        expect(fetchImpl).toHaveBeenCalledTimes(4); // init + notify + list + call, no second init
    });

    it('captures and resends the Mcp-Session-Id header', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 1, result: {} }, { 'Mcp-Session-Id': 'sess-123' }))
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', result: {} }))
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 2, result: { tools: [] } }));

        const client = createMcpClient({ url: 'https://mcp.example.com', fetchImpl });
        await client.listTools();

        const listCall = fetchImpl.mock.calls[2];
        expect(listCall[1].headers['Mcp-Session-Id']).toBe('sess-123');
    });

    it('parses SSE-formatted JSON-RPC responses', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(sseResponse([{ jsonrpc: '2.0', id: 1, result: {} }]))
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', result: {} }))
            .mockResolvedValueOnce(sseResponse([{ jsonrpc: '2.0', id: 2, result: { tools: [] } }]));

        const client = createMcpClient({ url: 'https://mcp.example.com', fetchImpl });
        const tools = await client.listTools();

        expect(tools).toEqual([]);
    });

    it('throws on a JSON-RPC error response', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 1, result: {} }))
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', result: {} }))
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 2, error: { code: -32601, message: 'Method not found' } }));

        const client = createMcpClient({ url: 'https://mcp.example.com', fetchImpl });
        await expect(client.listTools()).rejects.toThrow('Method not found');
    });
});

describe('mcpToolsAsSdkTools', () => {
    it('converts MCP tools into server-located SDK tools that proxy execution back to the MCP server', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 1, result: {} }))
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', result: {} }))
            .mockResolvedValueOnce(jsonResponse({
                jsonrpc: '2.0',
                id: 2,
                result: { tools: [{ name: 'getWeather', description: 'Get weather', inputSchema: { type: 'object', properties: {} } }] },
            }))
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 3, result: { content: [{ type: 'text', text: 'sunny' }] } }));

        const client = createMcpClient({ url: 'https://mcp.example.com', fetchImpl });
        const tools = await mcpToolsAsSdkTools(client);

        expect(tools.getWeather.location).toBe('server');
        expect(tools.getWeather).toHaveProperty('execute');

        const result = tools.getWeather.location === 'server'
            ? await tools.getWeather.execute({ city: 'NYC' })
            : undefined;

        expect(result).toEqual([{ type: 'text', text: 'sunny' }]);

        const callToolBody = JSON.parse(fetchImpl.mock.calls[3][1].body);
        expect(callToolBody).toMatchObject({ method: 'tools/call', params: { name: 'getWeather', arguments: { city: 'NYC' } } });
    });

    it('throws when the MCP tool result is marked as an error', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 1, result: {} }))
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', result: {} }))
            .mockResolvedValueOnce(jsonResponse({
                jsonrpc: '2.0',
                id: 2,
                result: { tools: [{ name: 'broken', inputSchema: { type: 'object', properties: {} } }] },
            }))
            .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 3, result: { isError: true, content: 'boom' } }));

        const client = createMcpClient({ url: 'https://mcp.example.com', fetchImpl });
        const tools = await mcpToolsAsSdkTools(client);

        const tool = tools.broken;
        await expect(tool.location === 'server' ? tool.execute({}) : Promise.resolve()).rejects.toThrow('returned an error');
    });
});
