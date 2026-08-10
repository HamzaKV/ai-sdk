import { describe, it, expect, vi } from 'vitest';
import { createAIClient, type MiddlewareContext } from './index';

const makeProvider = (result: unknown = 'ok') => ({
    name: 'test-provider',
    context: { config: {} },
    models: {
        chat: {
            send: vi.fn(async (input: any) => result),
        },
    },
});

describe('createAIClient', () => {
    it('calls through to the provider with no middleware', async () => {
        const provider = makeProvider('reply');
        const client = createAIClient({ providers: { test: provider } });

        const result = await client.test.chat.send({ text: 'hi' });

        expect(result).toBe('reply');
        expect(provider.models.chat.send).toHaveBeenCalledWith(
            { text: 'hi' },
            undefined,
        );
    });

    it('threads a transformed ctx through middleware into the call', async () => {
        const provider = makeProvider();
        const client = createAIClient({
            providers: { test: provider },
            middleware: [
                (ctx: MiddlewareContext) => ({
                    ...ctx,
                    input: { ...ctx.input, injected: true },
                }),
            ],
        });

        await client.test.chat.send({ text: 'hi' });

        expect(provider.models.chat.send).toHaveBeenCalledWith(
            { text: 'hi', injected: true },
            undefined,
        );
    });

    it('stops execution when middleware returns false', async () => {
        const provider = makeProvider();
        const client = createAIClient({
            providers: { test: provider },
            middleware: [() => false],
        });

        await expect(client.test.chat.send({ text: 'hi' })).rejects.toThrow(
            'Middleware stopped execution',
        );
        expect(provider.models.chat.send).not.toHaveBeenCalled();
    });

    it('runs onResponse hooks with the call context and resolved output', async () => {
        const provider = makeProvider('reply');
        const seen: unknown[] = [];
        const client = createAIClient({
            providers: { test: provider },
            onResponse: [
                (ctx, output) => {
                    seen.push([ctx.provider, ctx.model, ctx.call, output]);
                },
            ],
        });

        const result = await client.test.chat.send({ text: 'hi' });

        expect(result).toBe('reply');
        expect(seen).toEqual([['test', 'chat', 'send', 'reply']]);
    });

    it('passes the un-awaited generator to onResponse for stream-shaped calls', async () => {
        async function* gen() {
            yield 1;
        }
        const provider = makeProvider();
        provider.models.chat.send = vi.fn(async () => gen());
        const seen: unknown[] = [];
        const client = createAIClient({
            providers: { test: provider },
            onResponse: [(_ctx, output) => void seen.push(output)],
        });

        const result = await client.test.chat.send({ text: 'hi' });

        expect(seen).toHaveLength(1);
        expect(seen[0]).toBe(result);
        expect(typeof (seen[0] as AsyncGenerator).next).toBe('function');
    });
});
