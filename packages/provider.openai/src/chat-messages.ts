import type {
    FunctionToolCallOutputType,
    InputMessage,
    TextResponseOutput,
} from './index.js';

// Structurally compatible with @varlabs/ai.ui-core's ChatMessage - not imported directly, so
// this provider package doesn't take a dependency on the UI layer. Any object matching this
// shape (a real ChatMessage[] included) works here.
export type ChatMessageLike = {
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolCallId?: string;
    toolCalls?: { toolCallId: string; name: string; args: unknown }[];
};

type FunctionCallItem = Extract<
    TextResponseOutput<any>,
    { type: 'function_call' }
>;

type OpenAiInputItem =
    | InputMessage
    | FunctionCallItem
    | FunctionToolCallOutputType;

// Translates ui.core's generic ChatMessage[] into the Responses API's flat `input` array, so a
// resumed turn (after approve()/deny()) can be replayed as a valid request: an assistant
// message's toolCalls become function_call items, and the following 'tool' role message(s)
// become function_call_output items. Unlike Anthropic, the Responses API's input array has no
// role-alternation constraint, so items can stay flat - no merging needed.
export const toOpenAiInput = (
    messages: ChatMessageLike[],
): OpenAiInputItem[] => {
    const result: OpenAiInputItem[] = [];

    for (const message of messages) {
        const hasContent = message.content.trim().length > 0;
        const hasToolCalls = (message.toolCalls?.length ?? 0) > 0;

        if (message.role === 'tool') {
            result.push({
                call_id: message.toolCallId ?? '',
                type: 'function_call_output',
                output: message.content,
            });
            continue;
        }

        if (message.role === 'assistant' && hasToolCalls) {
            if (hasContent) {
                result.push({
                    type: 'message',
                    role: 'assistant',
                    content: message.content,
                });
            }
            for (const call of message.toolCalls ?? []) {
                result.push({
                    id: call.toolCallId,
                    type: 'function_call',
                    status: 'completed',
                    name: call.name,
                    call_id: call.toolCallId,
                    arguments: JSON.stringify(call.args),
                });
            }
            continue;
        }

        if (!hasContent) continue; // drop ui.core's empty placeholder assistant message

        result.push({
            type: 'message',
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: message.content,
        });
    }

    return result;
};
