export type AiSdkErrorKind =
    | 'rate_limit'
    | 'auth'
    | 'context_length'
    | 'server'
    | 'network'
    | 'unknown';

export class AiSdkError extends Error {
    readonly kind: AiSdkErrorKind;

    constructor(kind: AiSdkErrorKind, message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'AiSdkError';
        this.kind = kind;
    }
}

// `fetch.server`'s Fetch throws whatever the provider's error response body was
// (OpenAI/Anthropic both nest `{ type, message }`/`{ code, message }`), or a
// plain Error for network/timeout failures - never an AiSdkError itself, since
// providers aren't wired to throw one (see ai-sdk gap-scan notes). Classify
// opt-in at the call site rather than changing what providers throw.
export const classifyProviderError = (error: unknown): AiSdkError => {
    if (error instanceof AiSdkError) return error;

    if (error instanceof Error) {
        return new AiSdkError('network', error.message, { cause: error });
    }

    const body = error as {
        type?: string;
        code?: string;
        message?: string;
    } | null;
    const type = (body?.type ?? body?.code ?? '').toLowerCase();
    const message = body?.message ?? 'Request failed';

    if (type.includes('rate_limit')) {
        return new AiSdkError('rate_limit', message, { cause: error });
    }
    if (type.includes('auth') || type.includes('permission')) {
        return new AiSdkError('auth', message, { cause: error });
    }
    if (
        type.includes('invalid_request') &&
        /context length|maximum context|too many tokens|context_length/i.test(
            message,
        )
    ) {
        return new AiSdkError('context_length', message, { cause: error });
    }
    if (
        type.includes('overloaded') ||
        type.includes('server') ||
        type.includes('api_error')
    ) {
        return new AiSdkError('server', message, { cause: error });
    }
    return new AiSdkError('unknown', message, { cause: error });
};
