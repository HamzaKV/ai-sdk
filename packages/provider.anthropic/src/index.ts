import { defineProvider, type ProviderContext } from '@varlabs/ai/provider';
import fetch from '@varlabs/ai.utils/fetch.server';
import { handleStreamResponse } from '@varlabs/ai/utils/streaming';

const aiModels = [
    // Claude 4 Models
    'claude-opus-4-20250514',
    'claude-opus-4-0',  // alias
    'claude-sonnet-4-20250514',
    'claude-sonnet-4-0',  // alias

    // Claude 3.7 Models
    'claude-3-7-sonnet-20250219',
    'claude-3-7-sonnet-latest',  // alias

    // Claude 3.5 Models
    'claude-3-5-haiku-20241022',
    'claude-3-5-haiku-latest',  // alias
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-latest',  // alias
    'claude-3-5-sonnet-20240620',  // previous version

    // Claude 3 Models
    'claude-3-opus-20240229',
    'claude-3-opus-latest',  // alias
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
] as const;

type Model = (typeof aiModels)[number] | string & {};

type Citation =
| {
    cited_text: string;
    document_index: number;
    document_title: string;
    end_char_index: number;
    start_char_index: number;
    type: 'char_location';
}
| {
    cited_text: string;
    document_index: number;
    document_title: string;
    end_page_index: number;
    start_page_index: number;
    type: 'page_location';
}
| {
    cited_text: string;
    document_index: number;
    document_title: string;
    end_block_index: number;
    start_block_index: number;
    type: 'content_block_location';
}
| {
    cited_text: string;
    encrypted_index: string;
    title?: string;
    type: 'web_search_result_location';
    url: string;
};

type CacheControl = {
    type: 'ephemeral';
    ttl?: '5m' | '1h';
};

type ToolParameterBase = {
    type: 'string' | 'number' | 'boolean';
    description?: string;
    required?: boolean;
};

type ToolParameterArray = {
    type: 'array';
    items: (ToolParameterBase | ToolParameterObject | ToolParameterArray)[];
    description?: string;
    required?: boolean;
};

type ToolParameterObject = {
    type: 'object'
    properties: Record<string, ToolParameterObject | ToolParameterBase | ToolParameterArray>;
    description?: string;
    required?: boolean;
};

type ToolParameters = {
    type: 'object';
    properties: Record<string, ToolParameterObject | ToolParameterBase | ToolParameterArray>;
    additionalProperties?: boolean;
};

type InferParameter<T> = 
    T extends { type: 'string' } ? string :
    T extends { type: 'number' } ? number :
    T extends { type: 'boolean' } ? boolean :
    T extends { type: 'array', items: infer Items } ? InferArray<Items> :
    T extends { type: 'object', properties: infer Properties }
        ? Properties extends Record<string, any> 
            ? InferObject<Properties>
            : never
        : never;

type InferArray<T> = T extends (infer U)[] ? InferParameter<U>[] : never;

type InferObject<T extends Record<string, any>> = {
    [K in keyof T as T[K]['required'] extends true ? K : never]: InferParameter<T[K]>;
} & {
    [K in keyof T as T[K]['required'] extends true ? never : K]?: InferParameter<T[K]>;
};

// Final inference type
type InferToolParameters<T extends ToolParameters> = T extends { properties: infer Props }
    ? Props extends Record<string, any>
        ? InferObject<Props>
        : never
    : never;

type CustomTool<TParams extends ToolParameters = any, TResult = any> = {
    name: string;
    type: 'custom';
    description?: string;
    cache_control?: CacheControl;
    input_schema: TParams;
    execute: (args: InferToolParameters<TParams>) => Promise<TResult>;
};

export const customTool = <
    TParams extends ToolParameters,
    TResult = any
>(
    tool: CustomTool<TParams, TResult>
) => {
    return tool;
};

type Tool = 
| CustomTool
| {
    name: 'bash';
    type: 'bash_20241022';
    cache_control?: CacheControl;
}
| {
    name: 'bash';
    type: 'bash_20250124';
    cache_control?: CacheControl;
}
| {
    name: 'code_execution';
    type: 'code_execution_20250522';
    cache_control?: CacheControl;
}
| {
    name: 'computer';
    display_height_px: number;
    display_width_px: number;
    type: 'computer_20241022';
    cache_control?: CacheControl;
    display_number?: number;
}
| {
    name: 'computer';
    display_height_px: number;
    display_width_px: number;
    type: 'computer_20250124';
    cache_control?: CacheControl;
    display_number?: number;
}
| {
    name: 'str_replace_editor';
    type: 'text_editor_20241022';
    cache_control?: CacheControl;
}
| {
    name: 'str_replace_editor';
    type: 'text_editor_20250124';
    cache_control?: CacheControl;
}
| {
    name: 'str_replace_based_edit_tool';
    type: 'text_editor_20250429';
    cache_control?: CacheControl;
}
| {
    name: 'web_search';
    type: 'web_search_20250305';
    allowed_domains?: string[];
    blocked_domains?: string[];
    cache_control?: CacheControl;
    max_uses?: number;
    user_location?: {
        type: 'approximate';
        city?: string;
        country?: string;
        region?: string;
        timezone?: string;
    };
};

type TextContent = {
    type: 'text';
    text: string;
    cache_control?: CacheControl;
    citations?: Citation[];
};

type ImageContent = {
    type: 'image';
    cache_control?: CacheControl;
    source: 
    | {
        type: 'base64';
        media_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
        data: string; // Base64 encoded image data
    }
    | {
        type: 'url';
        url: string; // URL to the image
    }
    | {
        type: 'file';
        file_id: string; // Identifier for the file
    };
};

type FunctionInput = { 
    input: {
        model: Model;
        messages: {
            role: 'user' | 'assistant';
            content: string
                | {
                    type: 'text';
                    text: string;
                    cache_control?: CacheControl;
                    citations?: Citation[];
                }
                | ImageContent
                | {
                    type: 'document';
                    cache_control?: CacheControl;
                    citations?: Citation[];
                    context?: string;
                    title?: string;
                    source: 
                    | {
                        type: 'base64';
                        media_type: 'application/pdf';
                        data: string; // Base64 encoded PDF data
                    }
                    | {
                        type: 'text';
                        media_type: 'text/plain';
                        data: string; // Plain text data
                    }
                    | {
                        type: 'content';
                        content: string | (
                            | TextContent
                            | ImageContent
                        )[];
                    }
                    | {
                        type: 'url';
                        url: string; // URL to the document
                    }
                    | {
                        type: 'file';
                        file_id: string; // Identifier for the file
                    };
                }
                | {
                    type: 'thinking';
                    thinking: string; // Thinking content
                    signature: string;
                }
                | {
                    type: 'redacted_thinking';
                    data: string; // Redacted thinking content
                }
                | {
                    type: 'tool_use';
                    id: string; // Unique identifier for the tool use
                    name: string; // Name of the tool used
                    input: any; // Input parameters for the tool
                    cache_control?: CacheControl;
                }
                | {
                    type: 'tool_result';
                    tool_use_id: string; // Identifier for the tool use
                    is_error?: boolean; // Indicates if the tool result is an error
                    cache_control?: CacheControl;
                    content?: string | (
                        | TextContent
                        | ImageContent
                    )[];
                }
                | {
                    type: 'server_tool_use';
                    id: string; // Unique identifier for the server tool use
                    name: 'web_search' | 'code_execution';
                    input: any; // Input parameters for the server tool
                    cache_control?: CacheControl;
                }
                | {
                    type: 'web_search_tool_result';
                    tool_use_id: string; // Identifier for the web search tool use
                    cache_control?: CacheControl;
                    content: {
                        type: 'web_search_tool_result_error';
                        error_code: 
                        | 'invalid_tool_input' 
                        | 'unavailable'
                        | 'max_uses_exceeded'
                        | 'too_many_requests'
                        | 'query_too_long';
                    } | {
                        encrypted_content: string; // Encrypted content from the web search
                        title: string; // Title of the web search result
                        type: 'web_search_result';
                        url: string; // URL of the web search result
                        page_age?: string; // Age of the page in the search result
                    }[];
                }
                | {
                    type: 'code_execution_tool_result';
                    tool_use_id: string; // Identifier for the code execution tool use
                    cache_control?: CacheControl;
                    content: 
                    | {
                        type: 'code_execution_tool_result_error';
                        error_code: 
                        | 'invalid_tool_input' 
                        | 'unavailable'
                        | 'max_uses_exceeded'
                        | 'too_many_requests'
                        | 'query_too_long';
                    }
                    | {
                        type: 'code_execution_result';
                        stdout: string; // Standard output from the code execution
                        stderr: string; // Standard error output from the code execution
                        return_code: number; // Return code from the code execution
                        content: {
                            type: 'code_execution_output';
                            file_id: string; // Identifier for the file output
                        }[];
                    };
                }
                | {
                    type: 'mcp_tool_use';
                    id: string; // Unique identifier for the MCP tool use
                    input: any; // Input parameters for the MCP tool
                    name: string; // Name of the MCP tool
                    server_name: string; // Name of the MCP server
                    cache_control?: CacheControl;
                }
                | {
                    type: 'mcp_tool_result';
                    tool_use_id: string; // Identifier for the MCP tool use
                    content: string | {
                        text: string; // Text content from the MCP tool result
                        type: 'text';
                        citations?: Citation[]; // Citations associated with the text content
                        cache_control?: CacheControl; // Cache control for the content
                    };
                    cache_control?: CacheControl;
                    is_error?: boolean; // Indicates if the MCP tool result is an error
                }
                | {
                    type: 'container_upload';
                    file_id: string; // Identifier for the uploaded file
                    cache_control?: CacheControl; // Cache control for the upload
                };
        }[];
        max_tokens: number;
        container?: string;
        mcp_servers?: {
            name: string;
            type: 'url';
            url: string;
            authorization_token?: string;
            tool_configuration?: {
                allowed_tools?: string[];
                enabled?: boolean;
            };
        }[];
        metadata?: {
            user_id?: string;
        };
        service_tier?: 'auto' | 'standard_only';
        stop_sequences?: string[];
        system?: string 
        | {
            type: 'text';
            text: string;
            cache_control?: CacheControl;
            citations?: Citation[];
        };
        temperature?: number;
        thinking?: {
            budget_tokens: number;
            type: true;
        }
        | {
            type: false;
        };
        tool_choice?: 
        | {
            type: 'auto';
            disable_parallel_tool_user?: boolean;
        }
        | {
            type: 'any';
            disable_parallel_tool_user?: boolean;
        }
        | {
            name: string;
            type: 'tool';
            disable_parallel_tool_user?: boolean;
        }
        | {
            type: 'none';
        };
        tools?: Tool[];
        top_k?: number;
        top_p?: number;
    }; 
    config?: {
        fetchTimeout?: number;
    } 
};

type AnthropicResponse = {
    id: string;
    type: 'message';
    role: 'assistant';
    model: Model;
    stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | 'pause_turn' | 'refusal';
    stop_sequence: string;
    container?: {
        expires_at: string; // ISO 8601 date string
        id: string; // Unique identifier for the container
    };
    usage: {
        service_tier?: 'standard' | 'priority' | 'batch';
        server_tool_use?: {
            web_search_requests: number; // Number of web search requests made
        };
        output_tokens: number; // Number of output tokens generated
        input_tokens: number; // Number of input tokens processed
        cache_read_input_tokens?: number; // Number of input tokens read from cache
        cache_creation_input_tokens?: number; // Number of input tokens used to create cache
        cache_creation?: {
            ephemeral_1h_input_tokens: number; // Number of input tokens for ephemeral cache with 1 hour TTL
            ephemeral_5m_input_tokens: number; // Number of input tokens for ephemeral cache with 5 minutes TTL
        };
    };
    content: (
        | {
            type: 'text';
            text: string; // Text content of the message
        }
        | {
            type: 'thinking';
            thinking: string; // Thinking content
            signature: string;
        }
        | {
            type: 'redacted_thinking';
            data: string; // Redacted thinking content
        }
        | {
            type: 'tool_use';
            id: string; // Unique identifier for the tool use
            name: string; // Name of the tool used
            input: any; // Input parameters for the tool
            result?: any; // Result of the tool execution, if applicable
        }
        | {
            type: 'tool_result';
            tool_use_id: string; // Identifier for the tool use
            is_error?: boolean; // Indicates if the tool result is an error
            content?: string | (
                | TextContent
                | ImageContent
            )[];
        }
        | {
            type: 'server_tool_use';
            id: string; // Unique identifier for the server tool use
            name: 'web_search' | 'code_execution';
            input: any; // Input parameters for the server tool
        }
        | {
            type: 'web_search_tool_result';
            tool_use_id: string; // Identifier for the web search tool use
            content: {
                type: 'web_search_tool_result_error';
                error_code: 
                | 'invalid_tool_input' 
                | 'unavailable'
                | 'max_uses_exceeded'
                | 'too_many_requests'
                | 'query_too_long';
            } | {
                encrypted_content: string; // Encrypted content from the web search
                title: string; // Title of the web search result
                type: 'web_search_result';
                url: string; // URL of the web search result
                page_age?: string; // Age of the page in the search result
            }[];
        }
        | {
            type: 'code_execution_tool_result';
            tool_use_id: string; // Identifier for the code execution tool use
            content: 
            | {
                type: 'code_execution_tool_result_error';
                error_code: 
                | 'invalid_tool_input' 
                | 'unavailable'
                | 'max_uses_exceeded'
                | 'too_many_requests'
                | 'query_too_long';
            }
            | {
                type: 'code_execution_result';
                stdout: string; // Standard output from the code execution
                stderr: string; // Standard error output from the code execution
                return_code: number; // Return code from the code execution
                content: {
                    type: 'code_execution_output';
                    file_id: string; // Identifier for the file output
                }[];
            };
        }
        | {
            type: 'mcp_tool_use';
            id: string; // Unique identifier for the MCP tool use
            input: any; // Input parameters for the MCP tool
            name: string; // Name of the MCP tool
            server_name: string; // Name of the MCP server
        }
        | {
            type: 'mcp_tool_result';
            tool_use_id: string; // Identifier for the MCP tool use
            content: string | {
                text: string; // Text content from the MCP tool result
                type: 'text';
                citations?: Citation[]; // Citations associated with the text content
            };
            is_error?: boolean; // Indicates if the MCP tool result is an error
        }
        | {
            type: 'container_upload';
            file_id: string; // Identifier for the uploaded file
        }
    )[];
};

const anthropicProvider = defineProvider({
    name: 'anthropic',
    context: {
        config: {
            apiKey: '',
            baseUrl: 'https://api.anthropic.com/v1',
            apiVersion: '2023-06-01',
        },
    },
    models: {
        claude: {
            messages: async (input: FunctionInput, ctx) => {
                const { apiKey, baseUrl, apiVersion } = ctx.config;

                const request = await fetch<AnthropicResponse>(`${baseUrl}/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': apiVersion,
                    },
                    body: JSON.stringify({
                        ...input.input,
                        tools: input.input.tools?.map(tool => {
                            if (tool.type === 'custom') {
                                return {
                                    name: tool.name,
                                    type: 'custom',
                                    description: tool.description,
                                    cache_control: tool.cache_control,
                                    input_schema: tool.input_schema,
                                };
                            }
                            return tool;
                        }),
                    }),
                    MAX_FETCH_TIME: input.config?.fetchTimeout
                });

                for (const content of request.content) {
                    if (content.type === 'tool_use') {
                        const tool = input.input.tools?.find(t => t.name === content.name);

                        if (tool && tool.type === 'custom') {
                            type ToolParameters = InferToolParameters<typeof tool.input_schema>;
                            type ToolResponse = Awaited<ReturnType<typeof tool.execute>>;
                            const result = await tool.execute(content.input as ToolParameters);
                            content.result = result as ToolResponse;
                        }
                    }
                }

                return request;
            },
            stream: async (input: FunctionInput, ctx) => {
                const { apiKey, baseUrl, apiVersion } = ctx.config;

                const response = await fetch<Response, false>(`${baseUrl}/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': apiVersion,
                    },
                    body: JSON.stringify({
                        ...input.input,
                        stream: true,
                    }),
                    MAX_FETCH_TIME: input.config?.fetchTimeout
                }, false);

                return handleStreamResponse<AnthropicResponse>(response);
            },
        }
    }
});

export default anthropicProvider;
