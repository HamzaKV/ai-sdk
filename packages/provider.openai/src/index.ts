import { defineProvider, type ProviderContext } from '@varlabs/ai/provider';
import fetch from '@repo/utils/fetch.server';
import type { Tool } from '@varlabs/ai/utils/tool';
import { handleStreamResponse } from '@varlabs/ai/utils/streaming';

type ContentType = {
    type: 'input_text',
    text: string;
} | {
    type: 'input_image',
    image_url: string;
} | {
    type: 'input_file',
    file_id: string;
    filename: string;
    file_data: string;
};

type InputMessage = {
    type: 'message';
    role: 'developer' | 'user' | 'assistant' | 'system';
    content: string | ContentType[];
};

type BaseModels = 'babbage-002' | 'davinci-002';

type ReasoningModels = 'o4-mini' | 'o3' | 'o3-mini' | 'o1' | 'o1-pro' | 'o4-mini' | 'o3-mini';

type ChatModels = 'gpt-4.1' | 'gpt-4o' | 'chatgpt-4o' | 'gpt-4.1-mini' | 'gpt-4.1-nano' | 'gpt-4o-mini' | 'gpt-4-turbo' | 'gpt-4' | 'gpt-3.5-turbo';

type ImageGenerationModels = 'dall-e-2' | 'dall-e-3' | 'gpt-image-1';

type TextToSpeechModels = 'tts-1' | 'tts-1-hd' | 'gpt-4o-mini-tts';

type TranscriptionModels = 'whisper-1' | 'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe';

type EmbeddingModels = 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002';

type ModerationModels = 'omni-moderation-latest';

type TextResponseModels = BaseModels | ChatModels | ReasoningModels | string & {};

type StructuredOutputModels = 'gpt-4o' | 'o1' | 'o3' | 'gpt-4.1' | 'gpt-4o' | 'chatgpt-4o' | 'gpt-4.1-mini' | 'gpt-4.1-nano' | 'gpt-4o-mini';

type EmbedInput = {
    model: EmbeddingModels | string & {};
    text: string | string[];
};

type ComparisonFilter = {
    key: string;
    type: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'ne';
    value: string | number | boolean;
};

type CompoundFilter = {
    type: 'and' | 'or';
    filters: (ComparisonFilter | CompoundFilter)[];
};

type ReasoningOptionType = {
    effort: 'low' | 'medium' | 'high';
    summary: 'auto' | 'concise' | 'detailed';
    encrypted_content?: string;
}; 1

type FileSearchToolType = {
    type: 'file_search';
    vector_store_ids: string[];
    max_num_results?: number;
    ranking_options?: {
        ranker: string;
        score_threshold: number;
    };
    filters?: ComparisonFilter | CompoundFilter;
};

type WebSearchToolType = {
    type: 'web_search_preview' | 'web_search_preview_2025_03_11';
    search_context_size?: 'low' | 'medium' | 'high';
    user_location?: {
        type: string;
        city?: string;
        country?: string;
        region?: string;
        timezone?: string;
    };
};

type ComputerUseToolType = {
    type: 'computer_use_preview';
    environment: string;
    display_height: number;
    display_width: number;
};

type FunctionToolType = {
    type: 'function';
    strict: boolean;
    name: string;
    description?: string;
    parameters: string;
};

type CustomTool<TParams = any, TResult = any> = Omit<Tool<TParams, TResult>, 'name'> & {
    strict?: boolean;
};

export const customTool = <
    TParams,
    TResult = any
>(
    tool: CustomTool<TParams, TResult>
) => {
    return tool;
};

type CustomToolSet = Record<string, CustomTool>;

type FunctionToolCallOutputType = {
    id?: string;
    call_id: string;
    output: string;
    type: 'function_call_output';
    status?: 'in_progress' | 'completed' | 'incomplete';
};

type Annotation = {
    index: number;
    type: 'file_citation';
    file_id: string;
} | {
    type: 'url_citation';
    url: string;
    title: string;
    start_index: number;
    end_index: number;
} | {
    type: 'file_path';
    file_id: string;
    index: number;
};

type OutputText = {
    annotations: Annotation[];
    text: string;
    type: 'output_text';
    structured_output?: any;
};

type Refusal = {
    type: 'refusal';
    refusal: string;
};

type TextResponseOutput<
    T extends string | undefined,
> = {
    id: string;
    role: 'assistant';
    status: 'in_progress' | 'completed' | 'incomplete';
    type: 'message';
    content: (OutputText | Refusal)[];
} | {
    id: string;
    type: 'reasoning';
    status: 'in_progress' | 'completed' | 'incomplete';
    encrypted_content: T extends string
    ? string
    : null;
    summary: {
        type: 'summary_text';
        text: string;
    }[];
} | {
    id: string;
    type: 'file_search_call';
    status: 'in_progress' | 'completed' | 'incomplete' | 'failed';
    queries: string[];
    results: {
        attributes: Record<string, unknown>;
        file_id: string;
        filename: string;
        score: number;
        text: string;
    }[];
} | {
    id: string;
    type: 'web_search_call';
    status: 'in_progress' | 'completed' | 'incomplete' | 'failed';
} | {
    id: string;
    type: 'computer_call';
    status: 'in_progress' | 'completed' | 'incomplete';
    call_id: string;
    pending_safety_checks: {
        id: string;
        code: string;
        message: string;
    }[];
    action:
    | {
        button: 'left' | 'right' | 'wheel' | 'back' | 'forward';
        type: 'click';
        x: number;
        y: number;
    }
    | {
        type: 'double_click';
        x: number;
        y: number;
    }
    | {
        type: 'drag';
        path: {
            x: number;
            y: number;
        }[];
    }
    | {
        type: 'keypress';
        keys: string[];
    }
    | {
        type: 'move';
        x: number;
        y: number;
    }
    | {
        type: 'screenshot';
    }
    | {
        type: 'scroll';
        x: number;
        y: number;
        scroll_x: number;
        scroll_y: number;
    }
    | {
        type: 'type';
        text: string;
    }
    | {
        type: 'wait';
    };
} | {
    id: string;
    type: 'function_call';
    status: 'in_progress' | 'completed' | 'incomplete';
    name: string;
    call_id: string;
    arguments: string;
    result?: any;
};

type StructuredSchemaObjectType = {
    type: 'object';
    properties: Record<string, StructuredSchema>;
    additionalProperties?: boolean;
};

type StructuredSchema = {
    description?: string;
    required?: boolean;
} &
    ({
        type: 'string' | 'number' | 'boolean';
    }
        | StructuredSchemaObjectType
        | {
            type: 'array';
            items: StructuredSchema;
        });

type TextResponsesInput<
    Model extends TextResponseModels,
    // biome-ignore lint/complexity/noBannedTypes: <explanation>
    CustomTools extends CustomToolSet = {},
    Stream extends boolean = false,
> = {
    model: Model;
    instructions?: string;
    input: | string
        | (InputMessage
        | {
            type: 'item_reference';
            id: string;
        }
        | TextResponseOutput<any>
        | FunctionToolCallOutputType
    )[];
    structured_output?: Model extends StructuredOutputModels ? {
        name: string;
        strict?: boolean;
        schema: StructuredSchema;
    } : never;
    stream?: Stream;
    reasoning?: Model extends ReasoningModels ? ReasoningOptionType : never;
    max_output_tokens?: number;
    metadata?: Record<string, unknown>;
    truncation?: 'auto' | 'disabled';
    user?: string;
    previous_response_id?: string;
    store?: boolean;
    parallel_tool_calls?: boolean;
    tool_choice?: 'none' | 'auto' | 'required'
    | {
        type: 'file_search' | 'web_search_preview' | 'computer_use_preview';
    } | {
        name: string;
        type: 'function';
    };
    built_in_tools?: (FileSearchToolType | WebSearchToolType | ComputerUseToolType)[];
    custom_tools?: CustomTools;
} & ({
    temperature?: number;
    top_p?: never;
} | {
    temperature?: never;
    top_p?: number;
});

type TextResponseType<
    Model extends TextResponseModels,
    Input extends TextResponsesInput<Model>,
> = {
    id: string;
    object: 'response';
    created_at: number;
    status: 'completed' | 'failed' | 'in_progress' | 'incomplete';
    error?: {
        code: string;
        message: string;
    };
    incomplete_details?: {
        reason: string;
    };
    instructions?: Input['instructions'];
    max_output_tokens: Input['max_output_tokens'];
    metadata: Input['metadata'];
    model: Model;
    parallel_tool_calls: Input['parallel_tool_calls'];
    previous_response_id: Input['previous_response_id'];
    reasoning?: Input['reasoning'];
    temperature: Input['temperature'];
    tool_choice: Input['tool_choice'];
    // tools: Input['tools'];
    top_p: Input['top_p'];
    truncation: Input['truncation'];
    user: Input['user'];
    usage: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
        input_token_details: {
            cached_tokens: number;
        };
        output_token_details: {
            reasoning_tokens: number;
        };
    };
    output: TextResponseOutput<
        Input['reasoning'] extends ReasoningOptionType
        ? Input['reasoning']['encrypted_content']
        : undefined
    >[];
};

type StreamResponse<Model extends TextResponseModels> =
    | {
        type: 'response.created' | 'response.in_progress' | 'response.completed' | 'response.failed' | 'response.incomplete';
        response: TextResponseType<
            Model,
            TextResponsesInput<Model>
        >;
    }
    | {
        type: 'response.output_item.added' | 'response.output_item.done';
        output_index: number;
        item: (InputMessage | TextResponseOutput<undefined>)[];
    }
    | {
        type: 'response.content_part.added' | 'response.content_part.done';
        content_index: number;
        item_id: string;
        output_index: number;
        part: OutputText | Refusal;
    }
    | {
        type: 'response.output_text.delta';
        item_id: string;
        delta: string;
        content_index: number;
        output_index: number;
    }
    | {
        type: 'response.output_text.annotation.added';
        item_id: string;
        output_index: number;
        content_index: number;
        annotation_index: number;
        annotation: Annotation;
    }
    | {
        type: 'response.output_text.done';
        item_id: string;
        output_index: number;
        content_index: number;
        text: string;
    }
    | {
        type: 'response.refusal.delta';
        item_id: string;
        delta: string;
        content_index: number;
        output_index: number;
    }
    | {
        type: 'response.refusal.done';
        item_id: string;
        output_index: number;
        content_index: number;
        refusal: string;
    }
    | {
        type: 'response.function_call_arguments.delta';
        item_id: string;
        delta: string;
        output_index: number;
    }
    | {
        type: 'response.function_call_arguments.done';
        item_id: string;
        output_index: number;
        arguments: string;
    }
    | {
        type: 'response.file_search_call.in_progress' | 'response.file_search_call.searching' | 'response.file_search_call.completed' | 'response.web_search_call.in_progress' | 'response.web_search_call.searching' | 'response.web_search_call.completed';
        item_id: string;
        output_index: number;
    }
    | {
        type: 'response.reasoning_summary_part.added' | 'response.reasoning_summary_part.done';
        item_id: string;
        output_index: number;
        summary_index: number;
        part: {
            type: 'summary_text';
            text: string;
        };
    }
    | {
        type: 'response.reasoning_summary_text.delta';
        delta: string;
        item_id: string;
        output_index: number;
        summary_index: number;
    }
    | {
        type: 'response.reasoning_summary_text.done';
        item_id: string;
        output_index: number;
        summary_index: number;
        text: string;
    }
    | {
        type: 'error';
        code: string;
        message: string;
        param: string;
    };

type CreateResponseOutput<Model extends TextResponseModels, Stream extends boolean = false> = Stream extends true
    ? StreamResponse<Model>
    : TextResponseType<Model,TextResponsesInput<Model>>;

type BlobLike = {
    readonly size: number;
    readonly type: string;
    text(): Promise<string>;
    slice(start?: number, end?: number): BlobLike;
};

type FileLike = BlobLike & {
    readonly name: string;
    readonly lastModified: number;
};

type ImageCreateInput<Model extends ImageGenerationModels> = {
    model?: Model;
    background?: Model extends 'gpt-image-1' ? 'transparent' | 'opaque' | 'auto' : never;
    prompt: string;
    moderation?: Model extends 'gpt-image-1' ? 'low' | 'auto' : never;
    n?: number;
    output_compression?: Model extends 'gpt-image-1' ? number : never;
    output_format?: Model extends 'gpt-image-1' ? 'png' | 'jpeg' | 'webp' : never;
    quality?: Model extends 'gpt-image-1'
    ? 'auto' | 'high' | 'medium' | 'low'
    : Model extends 'dall-e-3'
    ? 'auto' | 'hd' | 'standard'
    : 'auto' | 'standard';
    response_format?: Model extends 'gpt-image-1' ? never : 'url' | 'b64_json';
    size?: Model extends 'gpt-image-1'
    ? 'auto' | '1024x1024' | '1536x1024' | '1024x1536'
    : Model extends 'dall-e-3'
    ? '1024x1024' | '1792x1024' | '1024x1792'
    : '256x256' | '512x512' | '1024x1024';
    style?: Model extends 'dall-e-3' ? 'vivid' | 'natural' : never;
    user?: string;
};

type ImageEditInput<Model extends Exclude<ImageGenerationModels, 'dall-e-3'>> = {
    image: FileLike | FileLike[];
    prompt: ImageCreateInput<Model>['prompt'];
    background?: ImageCreateInput<Model>['background'];
    mask?: FileLike;
    model?: Model;
    n?: ImageCreateInput<Model>['n'];
    quality?: ImageCreateInput<Model>['quality'];
    response_format?: ImageCreateInput<Model>['response_format'];
    size?: ImageCreateInput<Model>['size'];
    user?: string;
};

type ImageVariationInput = {
    image: FileLike;
    n?: ImageCreateInput<'dall-e-2'>['n'];
    repsonse_format?: ImageCreateInput<'dall-e-2'>['response_format'];
    size?: ImageCreateInput<'dall-e-2'>['size'];
    user?: string;
};

type ImageResponse<
    Model extends ImageGenerationModels,
    ResponseFormat extends 'b64_json' | 'url'
> = {
    created_at: number;
    usage: {
        total_tokens: number;
        input_tokens: number;
        output_tokens: number;
        input_token_details: {
            image_tokens: number;
            text_tokens: number;
        };
    };
    data: {
        b64_json: ResponseFormat extends 'b64_json' ? string : never;
        revised_prompt: Model extends 'dall-e-3' ? string : never;
        url: ResponseFormat extends 'url' ? string : never;
    };
};

type OpenAiStructuredSchema = Exclude<Omit<StructuredSchema, 'required'>, StructuredSchemaObjectType> | {
    type: 'object';
    properties: Record<string, OpenAiStructuredSchema>;
    additionalProperties?: boolean;
    required?: string[];
};

type GenAudioInput = {
    input: string;
    model: TextToSpeechModels;
    voice: 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'fable' | 'onyx' | 'nova' | 'sage' | 'shimmer' | 'verse';
    instructions?: string;
    response_format?: 'mp3' | 'opus' | 'aac' | 'wav' | 'pcm';
    speed?: number;
};

type TranscribeAudioInputResponseFormat = 'srt' | 'text' | 'json' | 'vtt' | 'verbose_json';

type TranscribeAudioInput<ResponseFormat extends TranscribeAudioInputResponseFormat> = {
    file: FileLike;
    model: TranscriptionModels;
    chunking_strategy?: 'auto' | {
        type: 'server_vad';
        prefix_padding_ms?: number;
        silence_duration_ms?: number;
        threshold?: number;
    };
    language?: string;
    prompt?: string;
    response_format?: ResponseFormat;
    stream?: boolean;
    temperature?: number;
    include?: ('logprobs' | string & {})[];
};

type TranslationAudioInput = {
    file: FileLike;
    model: 'whisper-1' | string & {};
    prompt?: string;
    response_format?: TranscribeAudioInputResponseFormat;
    temperature?: number;
};

/**
 * Transforms a StructuredSchema to an OpenAiStructuredSchema efficiently
 * Moving individual 'required' flags to a single 'required' array on objects
 */
const transformToOpenAiSchema = (schema: StructuredSchema): OpenAiStructuredSchema => {
    // Fast path for primitive types
    if (schema.type === 'string' || schema.type === 'number' || schema.type === 'boolean') {
        // Use destructuring with rest pattern to avoid object spread
        const { required, ...result } = schema;
        return result as OpenAiStructuredSchema;
    }

    // Fast path for array types
    if (schema.type === 'array') {
        const { required, ...rest } = schema;
        // Transform items without creating unnecessary intermediate objects
        return {
            ...rest,
            items: transformToOpenAiSchema(schema.items)
        } as OpenAiStructuredSchema;
    }

    // Handle object type - we know it's an object if we got here
    // @ts-expect-error
    const { required: _, properties, ...rest } = schema;
    const requiredProps: string[] = [];
    const transformedProps: Record<string, OpenAiStructuredSchema> = {};

    // Use for-in for performance with objects (slightly faster than Object.entries)
    for (const propName in properties) {
        const propSchema = properties[propName];

        // Check required flag and add to array if needed
        if (propSchema.required) {
            requiredProps.push(propName);
        }

        // Transform property schema
        transformedProps[propName] = transformToOpenAiSchema(propSchema);
    }

    // Create result with conditionally added required array
    const result: OpenAiStructuredSchema = {
        ...rest,
        type: 'object',
        properties: transformedProps
    };

    // Only add the required array if it contains elements
    if (requiredProps.length > 0) {
        result.required = requiredProps;
    }

    return result;
};

const openAiProvider = defineProvider({
    name: 'OpenAI',
    context: {
        config: {
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
        }
    },
    models: {
        embedding: {
            embed: async (input: EmbedInput, ctx) => {
                const { text, model } = input;

                type EmbeddingResponse = {
                    object: 'list';
                    data: {
                        object: 'embedding';
                        embedding: number[];
                        index: number;
                    }[];
                    model: EmbeddingModels;
                    usage: {
                        prompt_tokens: number;
                        total_tokens: number;
                    };
                }

                const response = await fetch<EmbeddingResponse>(`${ctx.config.baseUrl}/embeddings`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${ctx.config.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model,
                        input: text,
                    }),
                });

                return response;
            }
        },
        text: {
            create_response: async <
                Model extends TextResponseModels,
                // biome-ignore lint/complexity/noBannedTypes: <explanation>
                CustomTools extends CustomToolSet = {},
                Stream extends boolean = false,
            >(
                input: TextResponsesInput<Model, CustomTools, Stream>,
                ctx: ProviderContext
            ): Promise<CreateResponseOutput<Model, Stream>> => {
                type RequestBody = Omit<TextResponsesInput<Model, CustomTools, Stream>, 'custom_tools' | 'built_in_tools' | 'structured_output'> & {
                    tools: (
                        | FileSearchToolType
                        | WebSearchToolType
                        | ComputerUseToolType
                        | FunctionToolType
                    )[];
                    text?: {
                        format: {
                            type: 'json_schema';
                            name: string;
                            strict?: boolean;
                            schema: OpenAiStructuredSchema;
                        };
                    };
                };

                const bodyToolsArray: RequestBody['tools'] = [];
                if (input.built_in_tools) {
                    for (const tool of input.built_in_tools) {
                        bodyToolsArray.push(tool);
                    }
                }
                if (input.custom_tools) {
                    for (const [name, tool] of Object.entries(input.custom_tools)) {
                        const functionTool: FunctionToolType = {
                            type: 'function',
                            name,
                            strict: tool.strict ?? false,
                            description: tool.description,
                            parameters: JSON.stringify(tool.parameters),
                        };
                        bodyToolsArray.push(functionTool);
                    }
                }

                const requestBody: RequestBody = {
                    model: input.model,
                    instructions: input.instructions,
                    input: input.input,
                    stream: input.stream,
                    reasoning: input.reasoning,
                    max_output_tokens: input.max_output_tokens,
                    metadata: input.metadata,
                    truncation: input.truncation,
                    user: input.user,
                    previous_response_id: input.previous_response_id,
                    store: input.store,
                    parallel_tool_calls: input.parallel_tool_calls,
                    tool_choice: input.tool_choice,
                    temperature: input.temperature,
                    top_p: input.top_p,
                    tools: bodyToolsArray,
                    text: input.structured_output ? {
                        format: {
                            type: 'json_schema',
                            name: input.structured_output.name,
                            strict: input.structured_output.strict,
                            schema: transformToOpenAiSchema(input.structured_output.schema),
                        }
                    } : undefined,
                };

                if (input.stream) {
                    const response = await fetch<Response, false>(`${ctx.config.baseUrl}/responses`, {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${ctx.config.apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(requestBody),
                    }, false);

                    return handleStreamResponse(response) as unknown as CreateResponseOutput<Model, Stream>;
                }

                const response = await fetch<CreateResponseOutput<Model, false>>(`${ctx.config.baseUrl}/responses`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${ctx.config.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                });

                for (const item of response.output) {
                    if (item.type === 'function_call') {
                        const tool = input.custom_tools?.[item.name];

                        if (tool) {
                            const args = JSON.parse(item.arguments);
                            const toolResponse = await tool.execute(args);
                            item.result = toolResponse;
                        }
                    }

                    if (item.type === 'message') {
                        for (const content of item.content) {
                            if (content.type === 'output_text') {
                                try {
                                    const result = JSON.parse(content.text);
                                    content.structured_output = result;
                                } catch  {
                                    // If parsing fails, we can just leave it as is
                                }
                            }
                        }
                    }
                }

                return response as CreateResponseOutput<Model, Stream>;
            },
            get_response: async (id: string, ctx: ProviderContext) => {
                const response = await fetch<TextResponseType<any, any>>(`${ctx.config.baseUrl}/responses/${id}`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${ctx.config.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                });

                return response;
            },
            delete_response: async (id: string, ctx: ProviderContext) => {
                type DeleteResponse = {
                    id: string;
                    object: 'response';
                    deleted: boolean;
                };

                const response = await fetch<DeleteResponse>(`${ctx.config.baseUrl}/responses/${id}`, {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${ctx.config.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                });

                return response;
            },
            list_input_item_list: async (id: string, ctx: ProviderContext) => {
                type ListInputItemResponse = {
                    object: 'list';
                    data: (InputMessage | TextResponseOutput<undefined>)[];
                    first_id: string;
                    last_id: string;
                    has_more: boolean;
                };

                const response = await fetch<ListInputItemResponse>(`${ctx.config.baseUrl}/responses/${id}/input_items`, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${ctx.config.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                });

                return response;
            },
        },
        images: {
            create: async <Model extends ImageGenerationModels>(input: ImageCreateInput<Model>, ctx: ProviderContext) => {
                type ResponseFormat = Model extends 'gpt-image-1' ? 'b64_json' : Exclude<ImageCreateInput<Model>['response_format'], undefined>;
                const response = await fetch<ImageResponse<Model, ResponseFormat>>(`${ctx.config.baseUrl}/images/generations`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${ctx.config.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(input),
                });

                return response;
            },
            edit: async <Model extends Exclude<ImageGenerationModels, 'dall-e-3'>>(input: ImageEditInput<Model>, ctx: ProviderContext) => {
                const formData = new FormData();
                if (Array.isArray(input.image)) {
                    for (const image of input.image) {
                        // @ts-ignore
                        formData.append('image', image);
                    }
                } else {
                    // @ts-ignore
                    formData.append('image', input.image);
                }
                if (input.mask) {
                    // @ts-ignore
                    formData.append('mask', input.mask);
                }
                formData.append('prompt', input.prompt);
                if (input.model) {
                    formData.append('model', input.model);
                }
                if (input.n) {
                    formData.append('n', input.n.toString());
                }
                if (input.quality) {
                    formData.append('quality', input.quality);
                }
                if (input.response_format) {
                    formData.append('response_format', input.response_format);
                }
                if (input.size) {
                    formData.append('size', input.size);
                }

                type ResponseFormat = Model extends 'gpt-image-1' ? 'b64_json' : Exclude<ImageCreateInput<'dall-e-2'>['response_format'], undefined>;
                const response = await fetch<ImageResponse<Model, ResponseFormat>>(`${ctx.config.baseUrl}/images/edits`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${ctx.config.apiKey}`,
                    },
                    body: formData,
                });

                return response;
            },
            generate_variations: async (input: ImageVariationInput, ctx) => {
                const formData = new FormData();
                // @ts-ignore
                formData.append('image', input.image);
                formData.append('model', 'dall-e-2');
                if (input.n) {
                    formData.append('n', input.n.toString());
                }
                if (input.repsonse_format) {
                    formData.append('response_format', input.repsonse_format);
                }
                if (input.size) {
                    formData.append('size', input.size);
                }

                const response = await fetch<ImageResponse<'dall-e-2', Exclude<ImageCreateInput<'dall-e-2'>['response_format'], undefined>>>(`${ctx.config.baseUrl}/images/variations`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${ctx.config.apiKey}`,
                    },
                    body: formData,
                });

                return response;
            },
        },
        speech: {
            generate_audio: async (input: GenAudioInput, ctx) => {
                const contentTypeMap = {
                    'mp3': 'audio/mpeg',
                    'opus': 'audio/ogg',
                    'aac': 'audio/mp4',
                    'wav': 'audio/wav',
                    'pcm': 'audio/pcm'
                } as const;
                const response = await fetch<Response, false>(`${ctx.config.baseUrl}/audio/generations`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${ctx.config.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(input),
                }, false);

                const blob = await response.blob();

                return {
                    blob,
                    contentType: contentTypeMap[input.response_format ?? 'mp3'] as typeof contentTypeMap[keyof typeof contentTypeMap],
                };
            },
            transcribe_audio: async <ResponseFormat extends TranscribeAudioInputResponseFormat = 'json'>(input: TranscribeAudioInput<ResponseFormat>, ctx: ProviderContext) => {
                const formData = new FormData();
                // @ts-ignore
                formData.append('file', input.file);
                formData.append('model', input.model);
                if (input.chunking_strategy) {
                    formData.append('chunking_strategy', JSON.stringify(input.chunking_strategy));
                }
                if (input.language) {
                    formData.append('language', input.language);
                }
                if (input.prompt) {
                    formData.append('prompt', input.prompt);
                }
                if (input.response_format) {
                    formData.append('response_format', input.response_format);
                }
                if (input.stream) {
                    formData.append('stream', input.stream.toString());
                }
                if (input.temperature) {
                    formData.append('temperature', input.temperature.toString());
                }
                if (input.include) {
                    formData.append('include', JSON.stringify(input.include));
                }

                type JSONTranscriptionResponse = {
                    text: string;
                    logprobs?: {
                        bytes: string[];
                        logprob: number;
                        token: string;
                    };
                };
                type VerboseJSONTranscriptionResponse = {
                    duration: number;
                    language: string;
                    text: string;
                    segments: {
                        avg_logprob: number;
                        compression_ratio: number;
                        end: number;
                        id: number;
                        no_speech_prob: number;
                        seek: number;
                        start: number;
                        temperature: number;
                        text: string;
                        tokens: number[];
                    };
                    words: {
                        end: number;
                        start: number;
                        word: string;
                    };
                };
                type FetchResponse = ResponseFormat extends 'json'
                        ? JSONTranscriptionResponse
                        : ResponseFormat extends 'verbose_json'
                            ? VerboseJSONTranscriptionResponse
                            : Response;
                type FetchResponseFormat = ResponseFormat extends 'json' | 'verbose_json' ? false : true;
                const fetchResponseFormat = (input.response_format === 'json' || input.response_format === 'verbose_json') as FetchResponseFormat;
                const response = await fetch<FetchResponse, FetchResponseFormat>(`${ctx.config.baseUrl}/audio/transcriptions`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${ctx.config.apiKey}`,
                        'Content-Type': 'multipart/form-data',
                    },
                    body: formData,
                }, fetchResponseFormat);

                if (fetchResponseFormat) {
                    return input.response_format === 'json' ? response as JSONTranscriptionResponse : response as VerboseJSONTranscriptionResponse;
                } 

                const blob = await (response as Response).blob();
                return blob;
            },
            translate_audio: async (input: TranslationAudioInput, ctx) => {
                const formData = new FormData();
                // @ts-ignore
                formData.append('file', input.file);
                formData.append('model', input.model);
                if (input.prompt) {
                    formData.append('prompt', input.prompt);
                }
                if (input.response_format) {
                    formData.append('response_format', input.response_format);
                }
                if (input.temperature) {
                    formData.append('temperature', input.temperature.toString());
                }

                const response = await fetch<{
                    text: string;
                }>(`${ctx.config.baseUrl}/audio/translations`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${ctx.config.apiKey}`,
                        'Content-Type': 'multipart/form-data',
                    },
                    body: formData,
                });

                return response;
            },
        },
    },
});


export default openAiProvider;
