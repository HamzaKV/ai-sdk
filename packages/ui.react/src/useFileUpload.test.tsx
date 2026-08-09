import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useFileUpload } from './useFileUpload.js';
import { createInMemoryFileStorage } from '@varlabs/ai.file-storage';

describe('useFileUpload', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = vi
            .fn()
            .mockResolvedValue(new Response(null, { status: 200 }));
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('uploads a file and tracks it as an attachment', async () => {
        const storage = createInMemoryFileStorage();
        const { result } = renderHook(() => useFileUpload(storage));

        await act(async () => {
            await result.current.addFile(
                { name: 'a.txt', type: 'text/plain', size: 5 },
                new TextEncoder().encode('hello'),
            );
        });

        expect(result.current.attachments).toHaveLength(1);
        expect(result.current.attachments[0]).toMatchObject({
            name: 'a.txt',
            type: 'text/plain',
        });
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('memory://'),
            expect.objectContaining({ method: 'PUT' }),
        );
    });

    it('removes an attachment and deletes it from storage', async () => {
        const storage = createInMemoryFileStorage();
        const deleteSpy = vi.spyOn(storage, 'delete');
        const { result } = renderHook(() => useFileUpload(storage));

        let fileId = '';
        await act(async () => {
            const attachment = await result.current.addFile(
                { name: 'a.txt', type: 'text/plain', size: 5 },
                new TextEncoder().encode('hello'),
            );
            fileId = attachment.fileId;
        });

        act(() => {
            result.current.removeFile(fileId);
        });

        expect(result.current.attachments).toHaveLength(0);
        await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith(fileId));
    });

    it('clears all attachments', async () => {
        const storage = createInMemoryFileStorage();
        const { result } = renderHook(() => useFileUpload(storage));

        await act(async () => {
            await result.current.addFile(
                { name: 'a.txt', type: 'text/plain', size: 5 },
                new Uint8Array(),
            );
        });

        act(() => {
            result.current.clear();
        });

        expect(result.current.attachments).toHaveLength(0);
    });
});
