// Shared stream protocol every provider normalizes its own wire format into,
// so downstream consumers (ui.core, signatures) never see provider-specific shapes.
// A server-located tool call from the same round as a paused client-tool-call/hitl-pending
// event, already executed by the provider before it paused. Carried so the resumed turn can
// include its tool_result alongside the client tool's - a round is never resent half-finished.
export type SiblingToolResult = {
    toolCallId: string;
    name: string;
    args: unknown;
    result: unknown;
};

export type StreamEvent =
    | { type: 'text-delta'; delta: string }
    | { type: 'reasoning-delta'; delta: string }
    // Providers may emit this more than once, each time with only the fields
    // they know at that point in the stream - merge/replace rather than expecting one final total.
    | { type: 'usage'; inputTokens?: number; outputTokens?: number }
    | {
          type: 'client-tool-call';
          toolCallId: string;
          name: string;
          args: unknown;
          siblingResults?: SiblingToolResult[];
      }
    | {
          type: 'hitl-pending';
          jobId: string;
          toolCallId: string;
          name: string;
          args: unknown;
          siblingResults?: SiblingToolResult[];
      }
    | { type: 'error'; message: string }
    | { type: 'done' };

// Wraps a provider's raw parsed stream, mapping each raw chunk into the shared StreamEvent protocol.
export async function* mapToStreamEvents<T>(
    source: AsyncGenerator<T>,
    mapper: (chunk: T) => StreamEvent | StreamEvent[] | undefined,
): AsyncGenerator<StreamEvent> {
    for await (const chunk of source) {
        const mapped = mapper(chunk);
        if (!mapped) continue;
        if (Array.isArray(mapped)) {
            yield* mapped;
        } else {
            yield mapped;
        }
    }
}

export async function* handleStreamResponse<T>(
    res: Response,
    options?: {
        decoder?: TextDecoder;
        onRawChunk?: (chunk: string) => void;
        abortSignal?: AbortSignal;
        prefix?: string; // e.g., 'data:' or custom SSE prefix
    },
) {
    const reader = res.body?.getReader();
    if (!reader) throw new Error('Missing response body');

    const decoder = options?.decoder ?? new TextDecoder();
    const prefix = options?.prefix ?? 'data:';
    let buffer = '';

    while (true) {
        if (options?.abortSignal?.aborted) throw new Error('Stream aborted');

        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        options?.onRawChunk?.(chunk);

        const parts = buffer.split('\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
            const line = part.trim();
            // Skip empty lines or those that don't start with the prefix
            if (!line || !line.startsWith(prefix)) continue;

            const payload = line.replace(new RegExp(`^${prefix}\s*`), '');
            if (payload === '[DONE]') return;

            try {
                const trimmedPayload = payload.trim();
                if (!trimmedPayload) continue;
                const parsed = JSON.parse(trimmedPayload);
                yield parsed as T;
            } catch (err) {
                console.warn('Malformed JSON chunk:', payload);
            }
        }
    }
}

export const createDataStream = <T = unknown>(options: {
    execute: (dataStream: {
        writeData: (data: T) => void;
        writeMessageAnnotation: (annotation: Record<string, any>) => void;
        merge: (stream: AsyncGenerator<T>) => Promise<void>;
    }) => Promise<void> | void;
    onError?: (err: Error) => string;
}) => {
    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array>;

    const stream = new ReadableStream<Uint8Array>({
        async start(ctrl) {
            controller = ctrl;

            const writeData = (data: T) => {
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
                );
            };

            const writeMessageAnnotation = (
                annotation: Record<string, any>,
            ) => {
                controller.enqueue(
                    encoder.encode(
                        `data: ${JSON.stringify({ annotation })}\n\n`,
                    ),
                );
            };

            const merge = async (incoming: AsyncGenerator<T>) => {
                for await (const chunk of incoming) {
                    writeData(chunk);
                }
            };

            try {
                await options.execute({
                    writeData,
                    writeMessageAnnotation,
                    merge,
                });
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
            } catch (err: any) {
                const message = options.onError
                    ? options.onError(err)
                    : `Stream error: ${err.message}`;
                controller.enqueue(
                    encoder.encode(
                        `data: ${JSON.stringify({ error: message })}\n\n`,
                    ),
                );
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
            }
        },
    });

    return stream;
};

// Minimal shape of a Node.js http.ServerResponse - avoids depending on @types/node here.
type NodeWritableResponse = {
    write: (chunk: Uint8Array) => unknown;
    end: () => unknown;
    setHeader: (name: string, value: string) => unknown;
};

export const pipeStreamToResponse = async (
    stream: ReadableStream<Uint8Array>,
    res: Response | NodeWritableResponse,
    options?: {
        onError?: (err: Error) => string;
        onClose?: () => void;
    },
) => {
    const nodejsRes = res as any;

    // Node.js: Writable stream (e.g., Express, Fastify)
    if (
        typeof nodejsRes.write === 'function' &&
        typeof nodejsRes.end === 'function'
    ) {
        const reader = stream.getReader();
        nodejsRes.setHeader('Content-Type', 'text/event-stream');
        nodejsRes.setHeader('Cache-Control', 'no-cache');
        nodejsRes.setHeader('Connection', 'keep-alive');
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                nodejsRes.write(value);
            }
            nodejsRes.end();
            options?.onClose?.();
        } catch (err: any) {
            if (options?.onError) {
                nodejsRes.write(options.onError(err));
            }
            nodejsRes.end();
        }
        return;
    }

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    });
};
