import type { StreamEvent } from '@varlabs/ai/utils/streaming';
import type { AnthropicStreamEvent } from './index.js';

// Maps Anthropic's raw SSE stream events onto the SDK's shared StreamEvent
// protocol. Deliberately not covered: tool_use content blocks (mid-stream
// server-tool execution and client-tool-call/hitl-pending emission need
// argument-delta accumulation and job creation that don't exist at this
// layer yet - see the ai-sdk gap-scan notes). Citations and redacted-thinking
// content are also dropped; use the raw event stream directly if you need them.
export const mapAnthropicStreamEvent = (
    event: AnthropicStreamEvent,
): StreamEvent | StreamEvent[] | undefined => {
    switch (event.type) {
        case 'message_start':
            return {
                type: 'usage',
                inputTokens: event.message.usage.input_tokens,
            };
        case 'content_block_delta':
            if (event.delta.type === 'text_delta') {
                return { type: 'text-delta', delta: event.delta.text };
            }
            if (event.delta.type === 'thinking_delta') {
                return { type: 'reasoning-delta', delta: event.delta.thinking };
            }
            return undefined;
        case 'message_delta':
            return {
                type: 'usage',
                outputTokens: event.usage.output_tokens,
            };
        case 'message_stop':
            return { type: 'done' };
        case 'error':
            return { type: 'error', message: event.error.message };
        default:
            return undefined;
    }
};
