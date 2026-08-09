import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fetch from './fetch.client.js';

const mockResponse = (body: unknown, status = 200) => ({
    status,
    json: vi.fn().mockResolvedValue(body),
});

describe('fetch.client', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('parses and returns JSON on success', async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
            mockResponse({ hello: 'world' }),
        );

        const result = await Fetch('https://example.com', { method: 'GET' });

        expect(result).toEqual({ hello: 'world' });
    });

    it('throws the parsed error body on a 4xx/5xx status', async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
            mockResponse({ message: 'bad request' }, 400),
        );

        await expect(
            Fetch('https://example.com', { method: 'GET' }),
        ).rejects.toEqual({ message: 'bad request' });
    });

    it('returns the raw response when json=false', async () => {
        const raw = { status: 200, ok: true };
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(raw);

        const result = await Fetch(
            'https://example.com',
            { method: 'GET' },
            false,
        );

        expect(result).toBe(raw);
    });

    it('aborts and throws Timeout when MAX_FETCH_TIME elapses', async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
            (_url: string, options: { signal: AbortSignal }) => {
                return new Promise((_resolve, reject) => {
                    options.signal.addEventListener('abort', () =>
                        reject(new Error('aborted')),
                    );
                });
            },
        );

        await expect(
            Fetch('https://example.com', { method: 'GET', MAX_FETCH_TIME: 5 }),
        ).rejects.toThrow('Timeout');
    });
});
