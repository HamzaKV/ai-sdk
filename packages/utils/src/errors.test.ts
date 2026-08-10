import { describe, it, expect } from 'vitest';
import { AiSdkError, classifyProviderError } from './errors';

describe('classifyProviderError', () => {
    it('passes an existing AiSdkError through unchanged', () => {
        const original = new AiSdkError('rate_limit', 'slow down');
        expect(classifyProviderError(original)).toBe(original);
    });

    it('classifies a network/timeout Error', () => {
        const classified = classifyProviderError(new Error('Timeout'));
        expect(classified.kind).toBe('network');
        expect(classified.message).toBe('Timeout');
    });

    it('classifies an OpenAI-shaped rate limit error', () => {
        const classified = classifyProviderError({
            type: 'rate_limit_error',
            message: 'Rate limit reached',
        });
        expect(classified.kind).toBe('rate_limit');
    });

    it('classifies an Anthropic-shaped auth error', () => {
        const classified = classifyProviderError({
            type: 'authentication_error',
            message: 'invalid x-api-key',
        });
        expect(classified.kind).toBe('auth');
    });

    it('classifies a permission error as auth', () => {
        const classified = classifyProviderError({
            type: 'permission_error',
            message: 'not allowed',
        });
        expect(classified.kind).toBe('auth');
    });

    it('classifies a context-length invalid_request error', () => {
        const classified = classifyProviderError({
            type: 'invalid_request_error',
            message: 'This model maximum context length is 128000 tokens',
        });
        expect(classified.kind).toBe('context_length');
    });

    it('classifies a generic invalid_request error as unknown', () => {
        const classified = classifyProviderError({
            type: 'invalid_request_error',
            message: 'Missing required parameter',
        });
        expect(classified.kind).toBe('unknown');
    });

    it('classifies an Anthropic overloaded error as server', () => {
        const classified = classifyProviderError({
            type: 'overloaded_error',
            message: 'Overloaded',
        });
        expect(classified.kind).toBe('server');
    });

    it('classifies via code when type is absent', () => {
        const classified = classifyProviderError({
            code: 'rate_limit_exceeded',
            message: 'slow down',
        });
        expect(classified.kind).toBe('rate_limit');
    });

    it('falls back to unknown for an unrecognized shape', () => {
        const classified = classifyProviderError({ foo: 'bar' });
        expect(classified.kind).toBe('unknown');
        expect(classified.message).toBe('Request failed');
    });
});
