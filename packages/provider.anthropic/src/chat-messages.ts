import type { AnthropicContentBlock, AnthropicMessage } from './index.js';

// Structurally compatible with @varlabs/ai.ui-core's ChatMessage - not imported directly, so
// this provider package doesn't take a dependency on the UI layer. Any object matching this
// shape (a real ChatMessage[] included) works here.
export type ChatMessageLike = {
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolCallId?: string;
    toolCalls?: { toolCallId: string; name: string; args: unknown }[];
};

// Translates ui.core's generic ChatMessage[] into Anthropic's wire format, so a resumed turn
// (after approve()/deny()) can be replayed as a valid request: an assistant message's toolCalls
// become tool_use blocks, and the following 'tool' role message(s) become tool_result blocks -
// merged into a single user-role message, since Anthropic requires all tool_result blocks for
// one assistant turn to travel together (strict user/assistant role alternation).
export const toAnthropicMessages = (
    messages: ChatMessageLike[],
): AnthropicMessage[] => {
    const result: AnthropicMessage[] = [];

    for (const message of messages) {
        const hasContent = message.content.trim().length > 0;
        const hasToolCalls = (message.toolCalls?.length ?? 0) > 0;

        if (message.role === 'tool') {
            const block: AnthropicContentBlock = {
                type: 'tool_result',
                tool_use_id: message.toolCallId ?? '',
                content: message.content,
            };
            const last = result.at(-1);
            if (last?.role === 'user' && Array.isArray(last.content)) {
                last.content.push(block);
            } else {
                result.push({ role: 'user', content: [block] });
            }
            continue;
        }

        if (message.role === 'assistant' && hasToolCalls) {
            const blocks: AnthropicContentBlock[] = [];
            if (hasContent)
                blocks.push({ type: 'text', text: message.content });
            for (const call of message.toolCalls ?? []) {
                blocks.push({
                    type: 'tool_use',
                    id: call.toolCallId,
                    name: call.name,
                    input: call.args,
                });
            }
            result.push({ role: 'assistant', content: blocks });
            continue;
        }

        if (!hasContent) continue; // drop ui.core's empty placeholder assistant message

        result.push({
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: message.content,
        });
    }

    return result;
};
