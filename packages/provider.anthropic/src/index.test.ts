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
});
