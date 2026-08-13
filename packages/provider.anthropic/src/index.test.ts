import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import anthropicProvider, { customTool } from './index';
import fetch from '@varlabs/ai.utils/fetch.server';
import { handleStreamResponse } from '@varlabs/ai/utils/streaming';

vi.mock('@varlabs/ai.utils/fetch.server', () => {
    return {
        __esModule: true,
        default: vi.fn(),
    };
});

vi.mock('@varlabs/ai/utils/streaming', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('@varlabs/ai/utils/streaming')>();
    return {
        ...actual,
        handleStreamResponse: vi.fn((response) => response),
    };
});

describe('Anthropic Provider', () => {
    const mockContext = {
        config: {
            apiKey: 'test-api-key',
            baseUrl: 'https://api.anthropic.com/v1',
            apiVersion: '2023-06-01',
        },
    };

    const anthropic = anthropicProvider(mockContext);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('messages', () => {
        it('should call the messages API with correct parameters', async () => {
            const mockResponse = {
                id: 'msg_123',
                type: 'message',
                role: 'assistant',
                model: 'claude-3-5-sonnet-latest',
                stop_reason: 'end_turn',
                stop_sequence: null,
                usage: { input_tokens: 10, output_tokens: 5 },
                content: [{ type: 'text', text: 'Hello there' }],
            };

            (fetch as Mock<any>).mockResolvedValueOnce(mockResponse);

            const result = await anthropic.models.claude.messages({
                model: 'claude-3-5-sonnet-latest',
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 256,
            });

            expect(fetch).toHaveBeenCalledWith(
                `${mockContext.config.baseUrl}/messages`,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'x-api-key': mockContext.config.apiKey,
                        'anthropic-version': mockContext.config.apiVersion,
                        'Content-Type': 'application/json',
                    }),
                    body: expect.any(String),
                }),
            );

            expect(result).toEqual(mockResponse);
        });

        it('should execute server-located custom tools and attach the result', async () => {
            const mockResponse = {
                id: 'msg_124',
                type: 'message',
                role: 'assistant',
                model: 'claude-3-5-sonnet-latest',
                stop_reason: 'tool_use',
                stop_sequence: null,
                usage: { input_tokens: 10, output_tokens: 5 },
                content: [
                    {
                        type: 'tool_use',
                        id: 'toolu_1',
                        name: 'getWeather',
                        input: { location: 'New York' },
                    },
                ],
            };

            (fetch as Mock<any>).mockResolvedValueOnce(mockResponse);

            const mockExecute = { temperature: 72, conditions: 'sunny' };
            const weatherTool = customTool({
                name: 'getWeather',
                type: 'custom',
                location: 'server',
                description: 'Get the current weather for a location',
                input_schema: {
                    type: 'object',
                    properties: {
                        location: { type: 'string', description: 'City name' },
                    },
                },
                execute: vi
                    .fn<() => Promise<typeof mockExecute>>()
                    .mockResolvedValue(mockExecute),
            });

            const result = await anthropic.models.claude.messages({
                model: 'claude-3-5-sonnet-latest',
                messages: [
                    {
                        role: 'user',
                        content: "What's the weather in New York?",
                    },
                ],
                max_tokens: 256,
                tools: [weatherTool],
            });

            expect(weatherTool.execute).toHaveBeenCalledWith({
                location: 'New York',
            });
            expect((result.content[0] as any).result).toEqual(mockExecute);
        });

        it('should not execute client-located tools, leaving the call for the caller', async () => {
            const mockResponse = {
                id: 'msg_125',
                type: 'message',
                role: 'assistant',
                model: 'claude-3-5-sonnet-latest',
                stop_reason: 'tool_use',
                stop_sequence: null,
                usage: { input_tokens: 10, output_tokens: 5 },
                content: [
                    {
                        type: 'tool_use',
                        id: 'toolu_2',
                        name: 'getLocation',
                        input: {},
                    },
                ],
            };

            (fetch as Mock<any>).mockResolvedValueOnce(mockResponse);

            const locationTool = customTool({
                name: 'getLocation',
                type: 'custom',
                location: 'client',
                approval: 'auto',
                description: "Get the user's current location",
                input_schema: {
                    type: 'object',
                    properties: {},
                },
            });

            const result = await anthropic.models.claude.messages({
                model: 'claude-3-5-sonnet-latest',
                messages: [{ role: 'user', content: 'Where am I?' }],
                max_tokens: 256,
                tools: [locationTool],
            });

            expect((result.content[0] as any).result).toBeUndefined();
        });
    });

    describe('stream', () => {
        it('should call the messages API in streaming mode', async () => {
            const mockStreamResponse = {
                ok: true,
                status: 200,
                body: {},
                headers: new Headers(),
            };

            (fetch as Mock<any>).mockResolvedValueOnce(mockStreamResponse);

            await anthropic.models.claude.stream({
                model: 'claude-3-5-sonnet-latest',
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 256,
            });

            expect(fetch).toHaveBeenCalledWith(
                `${mockContext.config.baseUrl}/messages`,
                expect.objectContaining({
                    method: 'POST',
                }),
                false,
            );

            expect(handleStreamResponse).toHaveBeenCalledWith(
                mockStreamResponse,
            );
        });
    });

    describe('stream - tool loop', () => {
        // handleStreamResponse is mocked as identity above, so each "response" here is itself
        // an async iterable of raw AnthropicStreamEvent objects, bypassing real SSE parsing.
        async function* events(...items: any[]) {
            for (const item of items) yield item;
        }

        it('executes a server tool mid-stream and continues with a second request', async () => {
            (fetch as Mock<any>)
                .mockResolvedValueOnce(
                    events(
                        {
                            type: 'content_block_start',
                            index: 0,
                            content_block: {
                                type: 'tool_use',
                                id: 'toolu_1',
                                name: 'getWeather',
                                input: {},
                            },
                        },
                        {
                            type: 'content_block_delta',
                            index: 0,
                            delta: {
                                type: 'input_json_delta',
                                partial_json: '{"location":',
                            },
                        },
                        {
                            type: 'content_block_delta',
                            index: 0,
                            delta: {
                                type: 'input_json_delta',
                                partial_json: '"NYC"}',
                            },
                        },
                        { type: 'content_block_stop', index: 0 },
                        { type: 'message_stop' },
                    ),
                )
                .mockResolvedValueOnce(
                    events(
                        {
                            type: 'content_block_start',
                            index: 0,
                            content_block: { type: 'text', text: '' },
                        },
                        {
                            type: 'content_block_delta',
                            index: 0,
                            delta: { type: 'text_delta', text: "It's sunny." },
                        },
                        { type: 'content_block_stop', index: 0 },
                        { type: 'message_stop' },
                    ),
                );

            const mockExecute = { temperature: 72, conditions: 'sunny' };
            const weatherTool = customTool({
                name: 'getWeather',
                type: 'custom',
                location: 'server',
                description: 'Get the current weather for a location',
                input_schema: {
                    type: 'object',
                    properties: {
                        location: { type: 'string', description: 'City name' },
                    },
                },
                execute: vi
                    .fn<() => Promise<typeof mockExecute>>()
                    .mockResolvedValue(mockExecute),
            });

            const generator = await anthropic.models.claude.stream({
                model: 'claude-3-5-sonnet-latest',
                messages: [
                    { role: 'user', content: "What's the weather in NYC?" },
                ],
                max_tokens: 256,
                tools: [weatherTool],
            });

            const received: any[] = [];
            for await (const event of generator) received.push(event);

            expect(weatherTool.execute).toHaveBeenCalledWith({
                location: 'NYC',
            });
            expect(fetch).toHaveBeenCalledTimes(2);

            const secondCallBody = JSON.parse(
                (fetch as Mock<any>).mock.calls[1][1].body,
            );
            expect(secondCallBody.messages).toHaveLength(3);
            expect(secondCallBody.messages[1]).toEqual({
                role: 'assistant',
                content: [
                    {
                        type: 'tool_use',
                        id: 'toolu_1',
                        name: 'getWeather',
                        input: { location: 'NYC' },
                    },
                ],
            });
            expect(secondCallBody.messages[2]).toEqual({
                role: 'user',
                content: [
                    {
                        type: 'tool_result',
                        tool_use_id: 'toolu_1',
                        content: JSON.stringify(mockExecute),
                    },
                ],
            });

            // Only one 'done' - not emitted after the first (intermediate) round.
            expect(received.filter((e) => e.type === 'done')).toHaveLength(1);
            expect(received).toContainEqual({
                type: 'text-delta',
                delta: "It's sunny.",
            });
        });

        it('emits hitl-pending for a client tool requiring approval, without a follow-up request', async () => {
            (fetch as Mock<any>).mockResolvedValueOnce(
                events(
                    {
                        type: 'content_block_start',
                        index: 0,
                        content_block: {
                            type: 'tool_use',
                            id: 'toolu_2',
                            name: 'getLocation',
                            input: {},
                        },
                    },
                    {
                        type: 'content_block_delta',
                        index: 0,
                        delta: { type: 'input_json_delta', partial_json: '{}' },
                    },
                    { type: 'content_block_stop', index: 0 },
                    { type: 'message_stop' },
                ),
            );

            const locationTool = customTool({
                name: 'getLocation',
                type: 'custom',
                location: 'client',
                approval: 'required',
                description: "Get the user's current location",
                input_schema: { type: 'object', properties: {} },
            });

            const generator = await anthropic.models.claude.stream({
                model: 'claude-3-5-sonnet-latest',
                messages: [{ role: 'user', content: 'Where am I?' }],
                max_tokens: 256,
                tools: [locationTool],
            });

            const received: any[] = [];
            for await (const event of generator) received.push(event);

            expect(fetch).toHaveBeenCalledTimes(1);
            expect(received).toHaveLength(1);
            expect(received[0]).toMatchObject({
                type: 'hitl-pending',
                toolCallId: 'toolu_2',
                name: 'getLocation',
                args: {},
            });
            expect(typeof received[0].jobId).toBe('string');
        });

        it('emits client-tool-call for an auto-approved client tool', async () => {
            (fetch as Mock<any>).mockResolvedValueOnce(
                events(
                    {
                        type: 'content_block_start',
                        index: 0,
                        content_block: {
                            type: 'tool_use',
                            id: 'toolu_3',
                            name: 'getLocation',
                            input: {},
                        },
                    },
                    {
                        type: 'content_block_delta',
                        index: 0,
                        delta: { type: 'input_json_delta', partial_json: '{}' },
                    },
                    { type: 'content_block_stop', index: 0 },
                    { type: 'message_stop' },
                ),
            );

            const locationTool = customTool({
                name: 'getLocation',
                type: 'custom',
                location: 'client',
                approval: 'auto',
                description: "Get the user's current location",
                input_schema: { type: 'object', properties: {} },
            });

            const generator = await anthropic.models.claude.stream({
                model: 'claude-3-5-sonnet-latest',
                messages: [{ role: 'user', content: 'Where am I?' }],
                max_tokens: 256,
                tools: [locationTool],
            });

            const received: any[] = [];
            for await (const event of generator) received.push(event);

            expect(fetch).toHaveBeenCalledTimes(1);
            expect(received).toEqual([
                {
                    type: 'client-tool-call',
                    toolCallId: 'toolu_3',
                    name: 'getLocation',
                    args: {},
                    siblingResults: undefined,
                },
            ]);
        });

        it('stops and emits an error after exceeding max tool rounds', async () => {
            const toolUseRound = () =>
                events(
                    {
                        type: 'content_block_start',
                        index: 0,
                        content_block: {
                            type: 'tool_use',
                            id: 'toolu_loop',
                            name: 'getWeather',
                            input: {},
                        },
                    },
                    {
                        type: 'content_block_delta',
                        index: 0,
                        delta: { type: 'input_json_delta', partial_json: '{}' },
                    },
                    { type: 'content_block_stop', index: 0 },
                    { type: 'message_stop' },
                );

            for (let i = 0; i < 6; i++) {
                (fetch as Mock<any>).mockResolvedValueOnce(toolUseRound());
            }

            const weatherTool = customTool({
                name: 'getWeather',
                type: 'custom',
                location: 'server',
                description: 'Get the current weather for a location',
                input_schema: { type: 'object', properties: {} },
                execute: vi.fn().mockResolvedValue({ temperature: 72 }),
            });

            const generator = await anthropic.models.claude.stream({
                model: 'claude-3-5-sonnet-latest',
                messages: [{ role: 'user', content: 'loop forever' }],
                max_tokens: 256,
                tools: [weatherTool],
            });

            const received: any[] = [];
            for await (const event of generator) received.push(event);

            expect(fetch).toHaveBeenCalledTimes(5);
            expect(received.at(-1)).toMatchObject({ type: 'error' });
            expect(received.some((e) => e.type === 'done')).toBe(false);
        });
    });
});
