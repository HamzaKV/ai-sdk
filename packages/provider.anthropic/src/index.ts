import { defineProvider, type ProviderContext } from '@varlabs/ai/provider';
import fetch from '@varlabs/ai.utils/fetch.server';
import {
    handleStreamResponse,
    type StreamEvent,
    type SiblingToolResult,
} from '@varlabs/ai/utils/streaming';
import type {
    JsonSchemaParameters as ToolParameters,
    InferJsonSchemaParameters as InferToolParameters,
} from '@varlabs/ai/utils/json-schema';
import { mapAnthropicStreamEvent } from './stream-events.js';

const aiModels = [
    // Claude 4 Models
    'claude-opus-4-20250514',
    'claude-opus-4-0', // alias
    'claude-sonnet-4-20250514',
    'claude-sonnet-4-0', // alias

    // Claude 3.7 Models
    'claude-3-7-sonnet-20250219',
    'claude-3-7-sonnet-latest', // alias

    // Claude 3.5 Models
    'claude-3-5-haiku-20241022',
    'claude-3-5-haiku-latest', // alias
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet-latest', // alias
    'claude-3-5-sonnet-20240620', // previous version

    // Claude 3 Models
    'claude-3-opus-20240229',
    'claude-3-opus-latest', // alias
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
] as const;

type Model = (typeof aiModels)[number] | (string & {});

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

type CustomToolBase<TParams extends ToolParameters> = {
    name: string;
    type: 'custom';
    description?: string;
    cache_control?: CacheControl;
    input_schema: TParams;
};

type CustomTool<TParams extends ToolParameters = any, TResult = any> =
    | (CustomToolBase<TParams> & {
          location: 'server';
          execute: (args: InferToolParameters<TParams>) => Promise<TResult>;
      })
    | (CustomToolBase<TParams> & {
          location: 'client';
          approval: 'auto' | 'required';
      });

export const customTool = <T extends CustomTool<any, any>>(tool: T): T => {
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
              media_type:
                  | 'image/png'
                  | 'image/jpeg'
                  | 'image/webp'
                  | 'image/gif';
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

// A single input content block. Anthropic's real wire contract for `content` is
// `string | ContentBlock[]` - multi-block turns (e.g. text + tool_use, or several
// parallel tool_result blocks) require an array, so AnthropicMessagesInput.messages
// below accepts a bare block OR an array of them, never just a bare block alone.
export type AnthropicContentBlock =
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
                    content: string | (TextContent | ImageContent)[];
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
          content?: string | (TextContent | ImageContent)[];
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
          content:
              | {
                    type: 'web_search_tool_result_error';
                    error_code:
                        | 'invalid_tool_input'
                        | 'unavailable'
                        | 'max_uses_exceeded'
                        | 'too_many_requests'
                        | 'query_too_long';
                }
              | {
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
          content:
              | string
              | {
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

export type AnthropicMessage = {
    role: 'user' | 'assistant';
    content: string | AnthropicContentBlock | AnthropicContentBlock[];
};

type AnthropicMessagesInput = {
    model: Model;
    messages: AnthropicMessage[];
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
    system?:
        | string
        | {
              type: 'text';
              text: string;
              cache_control?: CacheControl;
              citations?: Citation[];
          };
    temperature?: number;
    thinking?:
        | {
              budget_tokens: number;
              type: 'enabled';
          }
        | {
              type: 'disabled';
          };
    tool_choice?:
        | {
              type: 'auto';
              disable_parallel_tool_use?: boolean;
          }
        | {
              type: 'any';
              disable_parallel_tool_use?: boolean;
          }
        | {
              name: string;
              type: 'tool';
              disable_parallel_tool_use?: boolean;
          }
        | {
              type: 'none';
          };
    tools?: Tool[];
    top_k?: number;
    top_p?: number;
};

type AnthropicResponse = {
    id: string;
    type: 'message';
    role: 'assistant';
    model: Model;
    stop_reason:
        | 'end_turn'
        | 'max_tokens'
        | 'stop_sequence'
        | 'tool_use'
        | 'pause_turn'
        | 'refusal';
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
              content?: string | (TextContent | ImageContent)[];
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
              content:
                  | {
                        type: 'web_search_tool_result_error';
                        error_code:
                            | 'invalid_tool_input'
                            | 'unavailable'
                            | 'max_uses_exceeded'
                            | 'too_many_requests'
                            | 'query_too_long';
                    }
                  | {
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
              content:
                  | string
                  | {
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

export type AnthropicStreamEvent =
    | { type: 'message_start'; message: AnthropicResponse }
    | {
          type: 'content_block_start';
          index: number;
          content_block: AnthropicResponse['content'][number];
      }
    | {
          type: 'content_block_delta';
          index: number;
          delta:
              | { type: 'text_delta'; text: string }
              | { type: 'input_json_delta'; partial_json: string }
              | { type: 'thinking_delta'; thinking: string }
              | { type: 'signature_delta'; signature: string }
              | { type: 'citations_delta'; citation: Citation };
      }
    | { type: 'content_block_stop'; index: number }
    | {
          type: 'message_delta';
          delta: {
              stop_reason: AnthropicResponse['stop_reason'] | null;
              stop_sequence: string | null;
          };
          usage: { output_tokens: number };
      }
    | { type: 'message_stop' }
    | { type: 'ping' }
    | { type: 'error'; error: { type: string; message: string } };

type AnthropicConfig = {
    apiKey: string;
    baseUrl: string;
    apiVersion: string;
    fetchTimeout?: number;
};

// Bounds the mid-stream server-tool continuation loop below - matches runReActAgent's
// maxSteps convention (packages/signatures/src/agent.ts) so a misbehaving tool loop can't
// spin forever mid-stream.
const MAX_TOOL_ROUNDS = 5;

// Reassembles one streamed content block (text/thinking/tool_use/...) from its
// content_block_start seed plus any deltas, in the shape needed to replay it verbatim in a
// follow-up request. Anthropic requires the full prior turn (including thinking blocks, when
// extended thinking is on) to be echoed back unmodified alongside a tool_result.
type AccumulatingBlock = AnthropicContentBlock & { inputJson?: string };

// Kicks off one round's request. Extracted so the caller can start round 0's request eagerly
// (before the consumer starts iterating the generator - matches every other fetch-backed
// method in this file) while later rounds fetch lazily as the tool loop progresses.
const postAnthropicStream = (
    messages: AnthropicMessagesInput['messages'],
    initialInput: AnthropicMessagesInput,
    ctx: ProviderContext<AnthropicConfig>,
) => {
    const { apiKey, baseUrl, apiVersion, fetchTimeout } = ctx.config;
    return fetch<Response, false>(
        `${baseUrl}/messages`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': apiVersion,
            },
            body: JSON.stringify({
                ...initialInput,
                messages,
                tools: initialInput.tools?.map((tool) => {
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
                stream: true,
            }),
            MAX_FETCH_TIME: fetchTimeout,
        },
        false,
    );
};

async function* anthropicStreamRounds(
    initialInput: AnthropicMessagesInput,
    ctx: ProviderContext<AnthropicConfig>,
    firstEvents: AsyncGenerator<AnthropicStreamEvent>,
): AsyncGenerator<StreamEvent> {
    let messages = initialInput.messages;
    let events = firstEvents;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        if (round > 0) {
            const response = await postAnthropicStream(
                messages,
                initialInput,
                ctx,
            );
            events = handleStreamResponse<AnthropicStreamEvent>(response);
        }

        const blocks = new Map<number, AccumulatingBlock>();
        let sawError = false;

        for await (const event of events) {
            // message_stop maps to a 'done' event, but that's only correct on the round that
            // ends the whole turn - suppressed here and emitted explicitly once we know whether
            // this round continues (tool execution) or finishes.
            if (event.type !== 'message_stop') {
                const mapped = mapAnthropicStreamEvent(event);
                if (mapped) {
                    if (Array.isArray(mapped)) yield* mapped;
                    else yield mapped;
                }
            }
            if (event.type === 'error') sawError = true;

            if (event.type === 'content_block_start') {
                const block: AccumulatingBlock = { ...event.content_block };
                if (block.type === 'tool_use') block.inputJson = '';
                blocks.set(event.index, block);
            } else if (event.type === 'content_block_delta') {
                const block = blocks.get(event.index);
                if (!block) continue;
                if (
                    event.delta.type === 'text_delta' &&
                    block.type === 'text'
                ) {
                    block.text += event.delta.text;
                } else if (
                    event.delta.type === 'thinking_delta' &&
                    block.type === 'thinking'
                ) {
                    block.thinking += event.delta.thinking;
                } else if (
                    event.delta.type === 'signature_delta' &&
                    block.type === 'thinking'
                ) {
                    block.signature =
                        (block.signature ?? '') + event.delta.signature;
                } else if (
                    event.delta.type === 'input_json_delta' &&
                    block.type === 'tool_use'
                ) {
                    block.inputJson =
                        (block.inputJson ?? '') + event.delta.partial_json;
                }
            } else if (event.type === 'content_block_stop') {
                const block = blocks.get(event.index);
                if (block?.type === 'tool_use') {
                    try {
                        block.input = block.inputJson
                            ? JSON.parse(block.inputJson)
                            : {};
                    } catch {
                        block.input = {};
                    }
                    block.inputJson = undefined;
                }
            }
        }

        if (sawError) return;

        const finalizedBlocks = [...blocks.entries()]
            .sort(([a], [b]) => a - b)
            .map(([, block]) => block as AnthropicContentBlock);
        const toolUseBlocks = finalizedBlocks.filter(
            (
                block,
            ): block is Extract<AnthropicContentBlock, { type: 'tool_use' }> =>
                block.type === 'tool_use',
        );

        if (toolUseBlocks.length === 0) {
            yield { type: 'done' };
            return;
        }

        const resolved = toolUseBlocks.map((block) => {
            const tool = initialInput.tools?.find((t) => t.name === block.name);
            const location =
                tool && tool.type === 'custom' ? tool.location : undefined;
            return { block, tool, location };
        });

        const clientCalls = resolved.filter((r) => r.location === 'client');

        if (clientCalls.length > 0) {
            // Execute any server-located tools from this same round first, so their results
            // travel alongside the pause event (see SiblingToolResult) - a round is never
            // resent half-finished.
            const siblingResults: SiblingToolResult[] = [];
            for (const { block, tool } of resolved) {
                if (
                    !tool ||
                    tool.type !== 'custom' ||
                    tool.location !== 'server'
                )
                    continue;
                type ToolParameters = InferToolParameters<
                    typeof tool.input_schema
                >;
                try {
                    const result = await tool.execute(
                        block.input as ToolParameters,
                    );
                    siblingResults.push({
                        toolCallId: block.id,
                        name: block.name,
                        args: block.input,
                        result,
                    });
                } catch (err) {
                    siblingResults.push({
                        toolCallId: block.id,
                        name: block.name,
                        args: block.input,
                        result: {
                            error:
                                err instanceof Error
                                    ? err.message
                                    : String(err),
                        },
                    });
                }
            }

            for (const { block, tool } of clientCalls) {
                const approval =
                    tool && tool.type === 'custom' && tool.location === 'client'
                        ? tool.approval
                        : 'required';
                const shared = {
                    toolCallId: block.id,
                    name: block.name,
                    args: block.input,
                    siblingResults: siblingResults.length
                        ? siblingResults
                        : undefined,
                };
                if (approval === 'required') {
                    yield {
                        type: 'hitl-pending',
                        jobId: crypto.randomUUID(),
                        ...shared,
                    };
                } else {
                    yield { type: 'client-tool-call', ...shared };
                }
            }
            return;
        }

        // Every tool_use in this round is server-located - execute and continue. Any unmatched
        // tool_use (no registered tool) is left unresolved, same "leave result unset"
        // convention as the non-streaming messages() method.
        const toolResults: AnthropicContentBlock[] = [];
        for (const { block, tool } of resolved) {
            if (!tool || tool.type !== 'custom' || tool.location !== 'server')
                continue;
            type ToolParameters = InferToolParameters<typeof tool.input_schema>;
            try {
                const result = await tool.execute(
                    block.input as ToolParameters,
                );
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: JSON.stringify(result),
                });
            } catch (err) {
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    is_error: true,
                    content: err instanceof Error ? err.message : String(err),
                });
            }
        }

        if (toolResults.length === 0) {
            yield { type: 'done' };
            return;
        }

        messages = [
            ...messages,
            { role: 'assistant', content: finalizedBlocks },
            { role: 'user', content: toolResults },
        ];
    }

    yield {
        type: 'error',
        message: `Exceeded max tool rounds (${MAX_TOOL_ROUNDS})`,
    };
}

const anthropicProvider = defineProvider({
    name: 'anthropic',
    context: {
        config: {
            apiKey: '',
            baseUrl: 'https://api.anthropic.com/v1',
            apiVersion: '2023-06-01',
        } as AnthropicConfig,
    },
    models: {
        claude: {
            messages: async (
                input: AnthropicMessagesInput,
                ctx: ProviderContext<AnthropicConfig>,
            ) => {
                const { apiKey, baseUrl, apiVersion, fetchTimeout } =
                    ctx.config;

                const request = await fetch<AnthropicResponse>(
                    `${baseUrl}/messages`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': apiKey,
                            'anthropic-version': apiVersion,
                        },
                        body: JSON.stringify({
                            ...input,
                            tools: input.tools?.map((tool) => {
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
                        MAX_FETCH_TIME: fetchTimeout,
                    },
                );

                for (const content of request.content) {
                    if (content.type === 'tool_use') {
                        const tool = input.tools?.find(
                            (t) => t.name === content.name,
                        );

                        // Client-located tools are executed by the caller, not here - leave result unset.
                        if (
                            tool &&
                            tool.type === 'custom' &&
                            tool.location === 'server'
                        ) {
                            type ToolParameters = InferToolParameters<
                                typeof tool.input_schema
                            >;
                            type ToolResponse = Awaited<
                                ReturnType<typeof tool.execute>
                            >;
                            const result = await tool.execute(
                                content.input as ToolParameters,
                            );
                            content.result = result as ToolResponse;
                        }
                    }
                }

                return request;
            },
            stream: async (
                input: AnthropicMessagesInput,
                ctx: ProviderContext<AnthropicConfig>,
            ) => {
                const firstResponse = await postAnthropicStream(
                    input.messages,
                    input,
                    ctx,
                );
                const firstEvents =
                    handleStreamResponse<AnthropicStreamEvent>(firstResponse);
                return anthropicStreamRounds(input, ctx, firstEvents);
            },
        },
    },
});

export default anthropicProvider;
