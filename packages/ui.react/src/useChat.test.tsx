import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useChat } from './useChat.js';
import type { StreamEvent } from '@varlabs/ai/utils/streaming';

async function* gen(events: StreamEvent[]): AsyncGenerator<StreamEvent> {
    for (const event of events) yield event;
}

describe('useChat', () => {
    it('sends the composed input on handleSubmit and clears the field', async () => {
        const streamFn = vi.fn().mockReturnValueOnce(gen([
            { type: 'text-delta', delta: 'hi there' },
            { type: 'done' },
        ]));

        const { result } = renderHook(() => useChat({ streamFn }));

        act(() => {
            result.current.handleInputChange({ target: { value: 'hello' } });
        });
        expect(result.current.input).toBe('hello');

        act(() => {
            result.current.handleSubmit();
        });
        expect(result.current.input).toBe('');

        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(result.current.messages.map((m) => m.content)).toEqual(['hello', 'hi there']);
    });

    it('does not submit an empty/whitespace-only input', () => {
        const streamFn = vi.fn();
        const { result } = renderHook(() => useChat({ streamFn }));

        act(() => {
            result.current.handleInputChange({ target: { value: '   ' } });
        });
        act(() => {
            result.current.handleSubmit();
        });

        expect(streamFn).not.toHaveBeenCalled();
    });

    it('exposes approve/deny for HITL flows and reaches idle after approve', async () => {
        const streamFn = vi.fn()
            .mockReturnValueOnce(gen([
                { type: 'hitl-pending', jobId: 'job_1', toolCallId: 'call_1', name: 'deleteAccount', args: {} },
            ]))
            .mockReturnValueOnce(gen([{ type: 'done' }]));

        const deleteAccount = vi.fn().mockResolvedValue({ ok: true });
        const { result } = renderHook(() => useChat({ streamFn, clientTools: { deleteAccount } }));

        act(() => {
            result.current.sendMessage('delete it');
        });

        await waitFor(() => expect(result.current.status).toBe('awaiting-approval'));
        expect(result.current.pendingApproval?.name).toBe('deleteAccount');

        await act(async () => {
            await result.current.approve();
        });

        expect(deleteAccount).toHaveBeenCalled();
        await waitFor(() => expect(result.current.status).toBe('idle'));
    });
});
