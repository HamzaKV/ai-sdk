import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import openAiProvider, { customTool } from './index';
import fetch from '@repo/utils/fetch.server';
import { handleStreamResponse } from '@varlabs/ai/utils/streaming';

// Mock the fetch utility
vi.mock('@repo/utils/fetch.server', () => {
    return {
        __esModule: true,
        default: vi.fn(),
    };
});

// Mock the streaming handler
vi.mock('@varlabs/ai/utils/streaming', () => {
    return {
        handleStreamResponse: vi.fn((response) => response),
    };
});


// Helper to create a mock file/blob for tests
function createMockFile(name = 'test.mp3', type = 'audio/mpeg', size = 1024) {
    return {
        name,
        type,
        size,
        lastModified: Date.now(),
        text: vi.fn<() => Promise<string>>().mockResolvedValue('mock file content'),
        slice: vi.fn().mockReturnThis(),
    } as unknown as File;
}

describe('OpenAI Provider', () => {
    const mockContext = {
        config: {
            apiKey: 'test-api-key',
            baseUrl: 'https://api.openai.com/v1',
        },
    };

    const openai = openAiProvider(mockContext);

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('embedding', () => {
        it('should call the embeddings API with correct parameters', async () => {
            const mockResponse = {
                object: 'list',
                data: [{ object: 'embedding', embedding: [0.1, 0.2, 0.3], index: 0 }],
                model: 'text-embedding-3-small',
                usage: { prompt_tokens: 5, total_tokens: 5 },
            };

            (fetch as Mock<any>).mockResolvedValueOnce(mockResponse);

            const input = {
                model: 'text-embedding-3-small',
                text: 'Test text for embedding'
            };

            const result = await openai.models.embedding.embed(input);

            expect(fetch).toHaveBeenCalledWith(
                `${mockContext.config.baseUrl}/embeddings`,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${mockContext.config.apiKey}`,
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify({
                        model: input.model,
                        input: input.text,
                    }),
                })
            );

            expect(result).toEqual(mockResponse);
        });
    });

    describe('text', () => {
        describe('create_response', () => {
            it('should call the responses API with correct parameters for non-streaming', async () => {
                const mockResponse = {
                    id: 'resp_123',
                    object: 'response',
                    created_at: 1697649,
                    status: 'completed',
                    model: 'gpt-4o',
                    output: [
                        {
                            id: 'msg_123',
                            role: 'assistant',
                            status: 'completed',
                            type: 'message',
                            content: [{ type: 'output_text', text: 'Hello world', annotations: [] }],
                        }
                    ],
                    usage: {
                        input_tokens: 10,
                        output_tokens: 2,
                        total_tokens: 12,
                        input_token_details: { cached_tokens: 0 },
                        output_token_details: { reasoning_tokens: 0 },
                    },
                };

                (fetch as Mock<any>).mockResolvedValueOnce(mockResponse);

                const input = {
                    model: 'gpt-4o',
                    instructions: 'You are a helpful assistant',
                    input: 'Hello, how are you?',
                    temperature: 0.7,
                    max_output_tokens: 256,
                };

                const result = await openai.models.text.create_response({
                    model: input.model,
                    instructions: input.instructions,
                    input: input.input,
                    temperature: input.temperature,
                    max_output_tokens: input.max_output_tokens,
                });

                expect(fetch).toHaveBeenCalledWith(
                    `${mockContext.config.baseUrl}/responses`,
                    expect.objectContaining({
                        method: 'POST',
                        headers: expect.objectContaining({
                            Authorization: `Bearer ${mockContext.config.apiKey}`,
                            'Content-Type': 'application/json',
                        }),
                        body: expect.any(String),
                    })
                );

                const bodyParam = JSON.parse(((fetch as Mock<any>).mock as any).calls[0][1].body);

                expect(bodyParam).toMatchObject({
                    model: input.model,
                    instructions: input.instructions,
                    input: input.input,
                    temperature: input.temperature,
                    max_output_tokens: input.max_output_tokens,
                    tools: [],
                });

                expect(result).toEqual(mockResponse);
            });

            it('should handle streaming responses correctly', async () => {
                const mockStreamResponse = {
                    // Mock Response object for streaming
                    ok: true,
                    status: 200,
                    body: {},
                    headers: new Headers(),
                };

                (fetch as Mock<any>).mockResolvedValueOnce(mockStreamResponse);

                const input = {
                    model: 'gpt-4o',
                    input: 'Hello',
                    stream: true,
                };

                await openai.models.text.create_response({
                    model: input.model,
                    input: input.input,
                    stream: input.stream,
                });

                expect(fetch).toHaveBeenCalledWith(
                    `${mockContext.config.baseUrl}/responses`,
                    expect.objectContaining({
                        method: 'POST',
                    }),
                    false // Third parameter indicates streaming
                );

                expect(handleStreamResponse).toHaveBeenCalledWith(mockStreamResponse);
            });

            it('should process custom tools correctly', async () => {
                const mockResponse = {
                    id: 'resp_123',
                    object: 'response',
                    created_at: 1697649,
                    status: 'completed',
                    model: 'gpt-4o',
                    output: [
                        {
                            id: 'func_123',
                            type: 'function_call',
                            name: 'getWeather',
                            call_id: 'call_123',
                            arguments: '{"location":"New York"}',
                            status: 'completed',
                        }
                    ],
                    usage: {
                        input_tokens: 10,
                        output_tokens: 8,
                        total_tokens: 18,
                        input_token_details: { cached_tokens: 0 },
                        output_token_details: { reasoning_tokens: 0 },
                    },
                };

                (fetch as Mock<any>).mockResolvedValueOnce(mockResponse);
                const mockExecute = { temperature: 72, conditions: 'sunny' };
                const weatherTool = customTool({
                    description: 'Get the current weather for a location',
                    parameters: {
                        type: 'object',
                        properties: {
                            location: { type: 'string', description: 'City name' },
                        },
                        required: ['location'],
                    },
                    execute: vi.fn<() => Promise<typeof mockExecute>>().mockResolvedValue(mockExecute),
                });

                const input = {
                    model: 'gpt-4o',
                    input: 'What\'s the weather in New York?',
                    custom_tools: {
                        getWeather: weatherTool,
                    },
                };

                const result = await openai.models.text.create_response(input);

                // Check if tool was added to the request
                const bodyParam = JSON.parse(((fetch as Mock<any>).mock as any).calls[0][1].body);
                expect(bodyParam.tools).toEqual([
                    {
                        type: 'function',
                        name: 'getWeather',
                        strict: false,
                        description: 'Get the current weather for a location',
                        parameters: JSON.stringify(weatherTool.parameters),
                    }
                ]);

                // Check if tool execution happened and result was added
                expect(weatherTool.execute).toHaveBeenCalledWith({ location: 'New York' });
                // expect(result.output[0].result).toEqual({ temperature: 72, conditions: 'sunny' });
            });
        });

        it('should get a response by ID', async () => {
            const mockResponse = {
                id: 'resp_123',
                object: 'response',
                created_at: 1697649,
                status: 'completed',
                model: 'gpt-4o',
                output: [],
                usage: {
                    input_tokens: 10,
                    output_tokens: 2,
                    total_tokens: 12,
                    input_token_details: { cached_tokens: 0 },
                    output_token_details: { reasoning_tokens: 0 },
                },
            };

            (fetch as Mock<any>).mockResolvedValueOnce(mockResponse);

            const result = await openai.models.text.get_response('resp_123');

            expect(fetch).toHaveBeenCalledWith(
                `${mockContext.config.baseUrl}/responses/resp_123`,
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${mockContext.config.apiKey}`,
                    }),
                })
            );

            expect(result).toEqual(mockResponse);
        });

        it('should delete a response by ID', async () => {
            const mockDeleteResponse = {
                id: 'resp_123',
                object: 'response',
                deleted: true,
            };

            (fetch as Mock<any>).mockResolvedValueOnce(mockDeleteResponse);

            const result = await openai.models.text.delete_response('resp_123');

            expect(fetch).toHaveBeenCalledWith(
                `${mockContext.config.baseUrl}/responses/resp_123`,
                expect.objectContaining({
                    method: 'DELETE',
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${mockContext.config.apiKey}`,
                    }),
                })
            );

            expect(result).toEqual(mockDeleteResponse);
        });

        it('should list input items for a response', async () => {
            const mockListResponse = {
                object: 'list',
                data: [
                    { type: 'message', role: 'user', content: 'Hello' }
                ],
                first_id: 'msg_1',
                last_id: 'msg_1',
                has_more: false,
            };

            (fetch as Mock<any>).mockResolvedValueOnce(mockListResponse);

            const result = await openai.models.text.list_input_item_list('resp_123');

            expect(fetch).toHaveBeenCalledWith(
                `${mockContext.config.baseUrl}/responses/resp_123/input_items`,
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${mockContext.config.apiKey}`,
                    }),
                })
            );

            expect(result).toEqual(mockListResponse);
        });
    });

    describe('images', () => {
        it('should create images correctly', async () => {
            const mockImageResponse = {
                created_at: 1677649,
                data: [
                    { url: 'https://example.com/image.jpg' }
                ],
                usage: {
                    total_tokens: 100,
                    input_tokens: 50,
                    output_tokens: 50,
                    input_token_details: {
                        image_tokens: 0,
                        text_tokens: 50,
                    }
                }
            };

            (fetch as Mock<any>).mockResolvedValueOnce(mockImageResponse);

            const input = {
                model: 'dall-e-3',
                prompt: 'A beautiful sunset over mountains',
                n: 1,
                size: '1024x1024',
                quality: 'hd',
                response_format: 'url',
            };

            const result = await openai.models.images.create({
                model: 'dall-e-3',
                prompt: input.prompt,
                n: input.n,
                size: '1024x1024',
                quality: 'auto',
                response_format: 'url',
            });

            expect(fetch).toHaveBeenCalledWith(
                `${mockContext.config.baseUrl}/images/generations`,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${mockContext.config.apiKey}`,
                        'Content-Type': 'application/json',
                    }),
                    body: expect.any(String),
                })
            );

            const fetchCalls = vi.mocked(fetch).mock.calls;
            const bodyParam = JSON.parse(fetchCalls[0][1].body as string);

            expect(bodyParam).toMatchObject({
                model: 'dall-e-3',
                prompt: input.prompt,
                n: input.n,
                size: '1024x1024',
                quality: 'auto',
                response_format: 'url',
            });

            expect(result).toEqual(mockImageResponse);
        });

        it('should handle image edits correctly', async () => {
            const mockEditResponse = {
                created_at: 1677649,
                data: [
                    { url: 'https://example.com/edited-image.jpg' }
                ],
                usage: {
                    total_tokens: 100,
                    input_tokens: 50,
                    output_tokens: 50,
                    input_token_details: {
                        image_tokens: 25,
                        text_tokens: 25,
                    }
                }
            };

            (fetch as Mock<any>).mockResolvedValueOnce(mockEditResponse);

            const mockImage = createMockFile('image.png', 'image/png');
            const mockMask = createMockFile('mask.png', 'image/png');

            const input = {
                image: mockImage,
                mask: mockMask,
                prompt: 'Remove the background and make it blue',
                model: 'dall-e-2',
                size: '1024x1024',
            };

            const result = await openai.models.images.edit({
                image: mockImage,
                mask: mockMask,
                prompt: input.prompt,
                model: 'dall-e-2',
                size: '1024x1024',
            });

            expect(fetch).toHaveBeenCalledWith(
                `${mockContext.config.baseUrl}/images/edits`,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${mockContext.config.apiKey}`,
                    }),
                    body: expect.any(FormData),
                })
            );

            expect(result).toEqual(mockEditResponse);
        });

        it('should handle image variations correctly', async () => {
            const mockVariationResponse = {
                created_at: 1677649,
                data: [
                    { url: 'https://example.com/variation.jpg' }
                ],
                usage: {
                    total_tokens: 100,
                    input_tokens: 50,
                    output_tokens: 50,
                    input_token_details: {
                        image_tokens: 25,
                        text_tokens: 25,
                    }
                }
            };

            (fetch as Mock<any>).mockResolvedValueOnce(mockVariationResponse);

            const mockImage = createMockFile('image.png', 'image/png');

            const input = {
                image: mockImage,
                n: 1,
                size: '1024x1024',
            };

            const result = await openai.models.images.generate_variations({
                image: mockImage,
                n: input.n,
                size: '1024x1024',
            });

            expect(fetch).toHaveBeenCalledWith(
                `${mockContext.config.baseUrl}/images/variations`,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${mockContext.config.apiKey}`,
                    }),
                    body: expect.any(FormData),
                })
            );

            expect(result).toEqual(mockVariationResponse);
        });
    });

    describe('speech', () => {
        it('should generate audio correctly', async () => {
            const mockAudioBlob = {
                size: 1024,
                type: 'audio/mpeg',
                text: vi.fn<() => Promise<string>>().mockResolvedValue('audio data'),
                slice: vi.fn(),
            };

            const mockResponse = {
                ok: true,
                blob: vi.fn<() => Promise<typeof mockAudioBlob>>().mockResolvedValue(mockAudioBlob)
            };

            (fetch as Mock<any>).mockResolvedValueOnce(mockResponse);

            const input = {
                model: 'tts-1',
                input: 'Hello world',
                voice: 'alloy',
                response_format: 'mp3',
            };

            const result = await openai.models.speech.generate_audio({
                model: 'tts-1',
                input: input.input,
                voice: 'alloy',
                response_format: 'mp3',
            });

            expect(fetch).toHaveBeenCalledWith(
                `${mockContext.config.baseUrl}/audio/generations`,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${mockContext.config.apiKey}`,
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify(input),
                }),
                false
            );

            expect(mockResponse.blob).toHaveBeenCalled();
            expect(result).toEqual({
                blob: mockAudioBlob,
                contentType: 'audio/mpeg',
            });
        });

        it('should transcribe audio correctly with JSON response', async () => {
            const mockTranscriptionResponse = {
                text: 'Hello world',
            };

            (fetch as Mock<any>).mockResolvedValueOnce(mockTranscriptionResponse);

            const mockFile = createMockFile();

            const result = await openai.models.speech.transcribe_audio({
                file: mockFile,
                model: 'whisper-1',
                response_format: 'json',
            });

            expect(fetch).toHaveBeenCalledWith(
                `${mockContext.config.baseUrl}/audio/transcriptions`,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${mockContext.config.apiKey}`,
                        'Content-Type': 'multipart/form-data',
                    }),
                    body: expect.any(FormData),
                }),
                expect.anything()
            );

            expect(result).toEqual(mockTranscriptionResponse);
        });

        it('should translate audio correctly', async () => {
            const mockTranslationResponse = {
                text: 'Hello world',
            };

            (fetch as Mock<any>).mockResolvedValueOnce(mockTranslationResponse);

            const mockFile = createMockFile();

            const input = {
                file: mockFile,
                model: 'whisper-1',
            };

            const result = await openai.models.speech.translate_audio(input);

            expect(fetch).toHaveBeenCalledWith(
                `${mockContext.config.baseUrl}/audio/translations`,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${mockContext.config.apiKey}`,
                        'Content-Type': 'multipart/form-data',
                    }),
                    body: expect.any(FormData),
                })
            );

            expect(result).toEqual(mockTranslationResponse);
        });
    });
});
