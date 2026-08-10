import type { StreamEvent } from '@varlabs/ai/utils/streaming';
import type { StreamResponse, TextResponseModels } from './index.js';

// Maps the Responses API's raw SSE stream events onto the SDK's shared
// StreamEvent protocol. Deliberately not covered: function_call_arguments
// events (mid-stream tool execution and client-tool-call/hitl-pending
// emission need argument-delta accumulation and job creation that don't
// exist at this layer yet - see the ai-sdk gap-scan notes), output items,
// content parts, annotations, refusals, and built-in tool call progress
// events. Use the raw event stream directly if you need them.
export const mapOpenAiStreamEvent = <Model extends TextResponseModels>(
    event: StreamResponse<Model>,
): StreamEvent | StreamEvent[] | undefined => {
    switch (event.type) {
        case 'response.output_text.delta':
            return { type: 'text-delta', delta: event.delta };
        case 'response.reasoning_summary_text.delta':
            return { type: 'reasoning-delta', delta: event.delta };
        case 'response.completed':
            return [
                {
                    type: 'usage',
                    inputTokens: event.response.usage.input_tokens,
                    outputTokens: event.response.usage.output_tokens,
                },
                { type: 'done' },
            ];
        case 'response.incomplete':
            return { type: 'done' };
        case 'response.failed':
            return {
                type: 'error',
                message:
                    event.response.error?.message ?? 'The response failed.',
            };
        case 'error':
            return { type: 'error', message: event.message };
        default:
            return undefined;
    }
};
