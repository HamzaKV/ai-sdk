import { describe, it, expect } from 'vitest';
import { mapToStreamEvents, type StreamEvent } from './streaming';

async function* source<T>(chunks: T[]): AsyncGenerator<T> {
    for (const chunk of chunks) yield chunk;
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
    const out: T[] = [];
    for await (const item of gen) out.push(item);
    return out;
}

describe('mapToStreamEvents', () => {
    it('yields one event per mapped chunk', async () => {
        const events = await collect(
            mapToStreamEvents(
                source(['a', 'b']),
                (chunk): StreamEvent => ({
                    type: 'text-delta',
                    delta: chunk,
                }),
            ),
        );

        expect(events).toEqual([
            { type: 'text-delta', delta: 'a' },
            { type: 'text-delta', delta: 'b' },
        ]);
    });

    it('flattens an array of events from a single chunk', async () => {
        const events = await collect(
            mapToStreamEvents(source(['x']), (): StreamEvent[] => [
                { type: 'usage', inputTokens: 1 },
                { type: 'done' },
            ]),
        );

        expect(events).toEqual([
            { type: 'usage', inputTokens: 1 },
            { type: 'done' },
        ]);
    });

    it('skips chunks the mapper declines to map', async () => {
        const events = await collect(
            mapToStreamEvents(source(['skip', 'keep']), (chunk) =>
                chunk === 'keep'
                    ? ({ type: 'text-delta', delta: chunk } as StreamEvent)
                    : undefined,
            ),
        );

        expect(events).toEqual([{ type: 'text-delta', delta: 'keep' }]);
    });
});
