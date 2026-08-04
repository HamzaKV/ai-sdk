import { describe, it, expect, vi } from 'vitest';
import { defineSignature } from './signature.js';
import { runReActAgent } from './agent.js';

const signature = defineSignature({
    input: { question: { type: 'string' } },
    output: { answer: { type: 'string' } },
});

describe('runReActAgent', () => {
    it('returns the parsed final answer when the model does not call a tool', async () => {
        const callModel = vi.fn().mockResolvedValue('{"answer": "Paris"}');

        const result = await runReActAgent({ signature, callModel }, { question: 'capital of France?' });

        expect(result).toEqual({ answer: 'Paris' });
        expect(callModel).toHaveBeenCalledTimes(1);
    });

    it('executes a server tool and feeds the result back before the final answer', async () => {
        const lookupCapital = {
            name: 'lookupCapital',
            description: 'Looks up a capital city',
            parameters: {},
            location: 'server' as const,
            execute: vi.fn().mockResolvedValue({ city: 'Paris' }),
        };

        const callModel = vi.fn()
            .mockResolvedValueOnce('{"tool": "lookupCapital", "args": {"country": "France"}}')
            .mockResolvedValueOnce('{"answer": "Paris"}');

        const result = await runReActAgent(
            { signature, tools: { lookupCapital }, callModel },
            { question: 'capital of France?' }
        );

        expect(lookupCapital.execute).toHaveBeenCalledWith({ country: 'France' });
        expect(result).toEqual({ answer: 'Paris' });
        expect(callModel).toHaveBeenCalledTimes(2);
        expect(callModel.mock.calls[1][0]).toContain('Called lookupCapital');
    });

    it('routes client-located tool calls to onClientToolCall', async () => {
        const getLocation = {
            name: 'getLocation',
            description: "Gets the user's location",
            parameters: {},
            location: 'client' as const,
        };

        const onClientToolCall = vi.fn().mockResolvedValue({ city: 'NYC' });
        const callModel = vi.fn()
            .mockResolvedValueOnce('{"tool": "getLocation", "args": {}}')
            .mockResolvedValueOnce('{"answer": "NYC"}');

        const result = await runReActAgent(
            { signature, tools: { getLocation }, onClientToolCall, callModel },
            { question: 'where am I?' }
        );

        expect(onClientToolCall).toHaveBeenCalledWith('getLocation', {});
        expect(result).toEqual({ answer: 'NYC' });
    });

    it('throws when a client tool is called without an onClientToolCall handler', async () => {
        const getLocation = {
            name: 'getLocation',
            description: "Gets the user's location",
            parameters: {},
            location: 'client' as const,
        };

        const callModel = vi.fn().mockResolvedValueOnce('{"tool": "getLocation", "args": {}}');

        await expect(
            runReActAgent({ signature, tools: { getLocation }, callModel, maxSteps: 1 }, { question: 'where?' })
        ).rejects.toThrow('no onClientToolCall handler was provided');
    });

    it('notes an unknown tool name and lets the model retry', async () => {
        const callModel = vi.fn()
            .mockResolvedValueOnce('{"tool": "doesNotExist", "args": {}}')
            .mockResolvedValueOnce('{"answer": "recovered"}');

        const result = await runReActAgent({ signature, callModel }, { question: 'x' });

        expect(result).toEqual({ answer: 'recovered' });
        expect(callModel.mock.calls[1][0]).toContain('does not exist');
    });

    it('throws after exceeding maxSteps without a final answer', async () => {
        const callModel = vi.fn().mockResolvedValue('{"tool": "doesNotExist", "args": {}}');

        await expect(
            runReActAgent({ signature, callModel, maxSteps: 2 }, { question: 'x' })
        ).rejects.toThrow('exceeded maxSteps (2)');
        expect(callModel).toHaveBeenCalledTimes(2);
    });
});
