import { describe, it, expect, vi } from 'vitest';
import { withRetry } from './retry';
import { AiSdkError } from './errors';

describe('withRetry', () => {
    it('returns the result on first success without retrying', async () => {
        const fn = vi.fn(async () => 'ok');
        const result = await withRetry(fn, { baseDelayMs: 0 });
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries retryable errors up to the limit, then succeeds', async () => {
        let calls = 0;
        const fn = vi.fn(async () => {
            calls++;
            if (calls < 3)
                throw { type: 'rate_limit_error', message: 'slow down' };
            return 'ok';
        });

        const result = await withRetry(fn, { baseDelayMs: 0, retries: 3 });

        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('throws immediately for a non-retryable error', async () => {
        const fn = vi.fn(async () => {
            throw { type: 'authentication_error', message: 'bad key' };
        });

        await expect(withRetry(fn, { baseDelayMs: 0 })).rejects.toMatchObject({
            message: 'bad key',
        });
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('gives up and rethrows after exhausting retries', async () => {
        const fn = vi.fn(async () => {
            throw { type: 'server_error', message: 'boom' };
        });

        await expect(
            withRetry(fn, { baseDelayMs: 0, retries: 2 }),
        ).rejects.toMatchObject({ message: 'boom' });
        expect(fn).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
    });

    it('honors a custom isRetryable predicate', async () => {
        let calls = 0;
        const fn = vi.fn(async () => {
            calls++;
            if (calls < 2) throw new AiSdkError('unknown', 'custom failure');
            return 'ok';
        });

        const result = await withRetry(fn, {
            baseDelayMs: 0,
            isRetryable: (error) =>
                error instanceof AiSdkError && error.kind === 'unknown',
        });

        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });
});
