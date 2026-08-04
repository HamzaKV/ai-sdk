import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.mock('undici', () => ({
    fetch: (...args: unknown[]) => mockFetch(...args),
}));

const { default: Fetch } = await import('./fetch.server.js');

const mockResponse = (body: unknown, status = 200) => ({
    status,
    json: vi.fn().mockResolvedValue(body),
});

describe('fetch.server', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    it('parses and returns JSON on success', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({ hello: 'world' }));

        const result = await Fetch('https://example.com', { method: 'GET' });

        expect(result).toEqual({ hello: 'world' });
    });

    it('throws the parsed error body on a 4xx/5xx status', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({ message: 'bad request' }, 400));

        await expect(Fetch('https://example.com', { method: 'GET' })).rejects.toEqual({ message: 'bad request' });
    });

    it('throws when the response body has an error field even on a 200', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse({ error: { message: 'oops' } }, 200));

        await expect(Fetch('https://example.com', { method: 'GET' })).rejects.toEqual({ message: 'oops' });
    });

    it('returns the raw response when json=false', async () => {
        const raw = { status: 200, ok: true };
        mockFetch.mockResolvedValueOnce(raw);

        const result = await Fetch('https://example.com', { method: 'GET' }, false);

        expect(result).toBe(raw);
    });

    it('aborts and throws Timeout when MAX_FETCH_TIME elapses', async () => {
        mockFetch.mockImplementationOnce((_url: string, options: { signal: AbortSignal }) => {
            return new Promise((_resolve, reject) => {
                options.signal.addEventListener('abort', () => reject(new Error('aborted')));
            });
        });

        await expect(
            Fetch('https://example.com', { method: 'GET', MAX_FETCH_TIME: 5 })
        ).rejects.toThrow('Timeout');
    });
});
