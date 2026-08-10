import { describe, it, expect } from 'vitest';
import { mapOpenAiStreamEvent } from './stream-events';
import type { StreamResponse } from './index';

describe('mapOpenAiStreamEvent', () => {
    it('maps a text delta', () => {
        const event: StreamResponse<'gpt-4o-mini'> = {
            type: 'response.output_text.delta',
            item_id: 'item_1',
            delta: 'hi',
            content_index: 0,
            output_index: 0,
        };
        expect(mapOpenAiStreamEvent(event)).toEqual({
            type: 'text-delta',
            delta: 'hi',
        });
    });

    it('maps a reasoning summary delta', () => {
        const event: StreamResponse<'gpt-4o-mini'> = {
            type: 'response.reasoning_summary_text.delta',
            delta: 'because...',
            item_id: 'item_1',
            output_index: 0,
            summary_index: 0,
        };
        expect(mapOpenAiStreamEvent(event)).toEqual({
            type: 'reasoning-delta',
            delta: 'because...',
        });
    });

    it('maps response.completed to a usage event and a done event', () => {
        const event = {
            type: 'response.completed',
            response: {
                usage: { input_tokens: 10, output_tokens: 5 },
            },
        } as StreamResponse<'gpt-4o-mini'>;
        expect(mapOpenAiStreamEvent(event)).toEqual([
            { type: 'usage', inputTokens: 10, outputTokens: 5 },
            { type: 'done' },
        ]);
    });

    it('maps response.incomplete to done', () => {
        const event = {
            type: 'response.incomplete',
            response: {},
        } as StreamResponse<'gpt-4o-mini'>;
        expect(mapOpenAiStreamEvent(event)).toEqual({ type: 'done' });
    });

    it('maps response.failed to an error event using the response error message', () => {
        const event = {
            type: 'response.failed',
            response: { error: { code: 'server_error', message: 'boom' } },
        } as StreamResponse<'gpt-4o-mini'>;
        expect(mapOpenAiStreamEvent(event)).toEqual({
            type: 'error',
            message: 'boom',
        });
    });

    it('falls back to a generic message when a failed response has no error', () => {
        const event = {
            type: 'response.failed',
            response: {},
        } as StreamResponse<'gpt-4o-mini'>;
        expect(mapOpenAiStreamEvent(event)).toEqual({
            type: 'error',
            message: 'The response failed.',
        });
    });

    it('maps a top-level error event', () => {
        const event: StreamResponse<'gpt-4o-mini'> = {
            type: 'error',
            code: 'server_error',
            message: 'boom',
            param: '',
        };
        expect(mapOpenAiStreamEvent(event)).toEqual({
            type: 'error',
            message: 'boom',
        });
    });

    it('ignores unmapped event types', () => {
        const event: StreamResponse<'gpt-4o-mini'> = {
            type: 'response.created',
            response: {} as any,
        };
        expect(mapOpenAiStreamEvent(event)).toBeUndefined();
    });
});
