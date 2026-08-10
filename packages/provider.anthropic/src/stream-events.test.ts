import { describe, it, expect } from 'vitest';
import { mapAnthropicStreamEvent } from './stream-events';
import type { AnthropicStreamEvent } from './index';

describe('mapAnthropicStreamEvent', () => {
    it('maps message_start to a partial usage event with input tokens', () => {
        const event: AnthropicStreamEvent = {
            type: 'message_start',
            message: {
                usage: { input_tokens: 12, output_tokens: 0 },
            } as any,
        };
        expect(mapAnthropicStreamEvent(event)).toEqual({
            type: 'usage',
            inputTokens: 12,
        });
    });

    it('maps a text_delta content block to text-delta', () => {
        const event: AnthropicStreamEvent = {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: 'hi' },
        };
        expect(mapAnthropicStreamEvent(event)).toEqual({
            type: 'text-delta',
            delta: 'hi',
        });
    });

    it('maps a thinking_delta content block to reasoning-delta', () => {
        const event: AnthropicStreamEvent = {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'thinking_delta', thinking: 'because...' },
        };
        expect(mapAnthropicStreamEvent(event)).toEqual({
            type: 'reasoning-delta',
            delta: 'because...',
        });
    });

    it('ignores other content block delta kinds', () => {
        const event: AnthropicStreamEvent = {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'signature_delta', signature: 'sig' },
        };
        expect(mapAnthropicStreamEvent(event)).toBeUndefined();
    });

    it('maps message_delta to a partial usage event with output tokens', () => {
        const event: AnthropicStreamEvent = {
            type: 'message_delta',
            delta: { stop_reason: 'end_turn', stop_sequence: null },
            usage: { output_tokens: 42 },
        };
        expect(mapAnthropicStreamEvent(event)).toEqual({
            type: 'usage',
            outputTokens: 42,
        });
    });

    it('maps message_stop to done', () => {
        expect(mapAnthropicStreamEvent({ type: 'message_stop' })).toEqual({
            type: 'done',
        });
    });

    it('maps error to an error event', () => {
        const event: AnthropicStreamEvent = {
            type: 'error',
            error: { type: 'overloaded_error', message: 'busy' },
        };
        expect(mapAnthropicStreamEvent(event)).toEqual({
            type: 'error',
            message: 'busy',
        });
    });

    it('ignores ping and content_block_start/stop', () => {
        expect(mapAnthropicStreamEvent({ type: 'ping' })).toBeUndefined();
        expect(
            mapAnthropicStreamEvent({
                type: 'content_block_start',
                index: 0,
                content_block: { type: 'text', text: '' },
            }),
        ).toBeUndefined();
        expect(
            mapAnthropicStreamEvent({ type: 'content_block_stop', index: 0 }),
        ).toBeUndefined();
    });
});
