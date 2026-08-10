import { classifyProviderError } from './errors.js';

export type RetryOptions = {
    retries?: number; // default 3
    baseDelayMs?: number; // default 300, doubled per attempt with jitter
    isRetryable?: (error: unknown) => boolean; // default: rate_limit | server | network
};

const defaultIsRetryable = (error: unknown): boolean => {
    const kind = classifyProviderError(error).kind;
    return kind === 'rate_limit' || kind === 'server' || kind === 'network';
};

// Opt-in retry wrapper - call it around a single provider call, not baked into
// provider config, so retry policy stays a caller decision.
export const withRetry = async <T>(
    fn: () => Promise<T>,
    options?: RetryOptions,
): Promise<T> => {
    const retries = options?.retries ?? 3;
    const baseDelayMs = options?.baseDelayMs ?? 300;
    const isRetryable = options?.isRetryable ?? defaultIsRetryable;

    let attempt = 0;
    for (;;) {
        try {
            return await fn();
        } catch (error) {
            attempt++;
            if (attempt > retries || !isRetryable(error)) throw error;
            const delay =
                baseDelayMs * 2 ** (attempt - 1) * (0.5 + Math.random() * 0.5);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
};
