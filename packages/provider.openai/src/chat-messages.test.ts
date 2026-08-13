import { describe, it, expect } from 'vitest';
import { toOpenAiInput, type ChatMessageLike } from './chat-messages';

describe('toOpenAiInput', () => {
    it('passes plain user/assistant text through as message items', () => {
        const messages: ChatMessageLike[] = [
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'hello' },
        ];

        expect(toOpenAiInput(messages)).toEqual([
            { type: 'message', role: 'user', content: 'hi' },
            { type: 'message', role: 'assistant', content: 'hello' },
        ]);
    });

    it('drops the empty placeholder assistant message', () => {
        const messages: ChatMessageLike[] = [
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: '' },
        ];

        expect(toOpenAiInput(messages)).toEqual([
            { type: 'message', role: 'user', content: 'hi' },
        ]);
    });

    it('turns an assistant message with toolCalls into a message item + function_call items', () => {
        const messages: ChatMessageLike[] = [
            {
                role: 'assistant',
                content: 'Let me check.',
                toolCalls: [
                    {
                        toolCallId: 'call_1',
                        name: 'getWeather',
                        args: { location: 'NYC' },
                    },
                ],
            },
        ];

        expect(toOpenAiInput(messages)).toEqual([
            { type: 'message', role: 'assistant', content: 'Let me check.' },
            {
                id: 'call_1',
                type: 'function_call',
                status: 'completed',
                name: 'getWeather',
                call_id: 'call_1',
                arguments: JSON.stringify({ location: 'NYC' }),
            },
        ]);
    });

    it('omits the message item when the assistant said nothing before calling tools', () => {
        const messages: ChatMessageLike[] = [
            {
                role: 'assistant',
                content: '',
                toolCalls: [
                    { toolCallId: 'call_1', name: 'getWeather', args: {} },
                ],
            },
        ];

        const result = toOpenAiInput(messages);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ type: 'function_call' });
    });

    it('translates tool-role messages into flat function_call_output items', () => {
        const messages: ChatMessageLike[] = [
            {
                role: 'assistant',
                content: '',
                toolCalls: [
                    { toolCallId: 'call_1', name: 'getWeather', args: {} },
                    { toolCallId: 'call_2', name: 'deleteAccount', args: {} },
                ],
            },
            {
                role: 'tool',
                toolCallId: 'call_1',
                content: JSON.stringify({ temperature: 72 }),
            },
            {
                role: 'tool',
                toolCallId: 'call_2',
                content: JSON.stringify({ ok: true }),
            },
        ];

        const result = toOpenAiInput(messages);
        expect(result.at(-2)).toEqual({
            call_id: 'call_1',
            type: 'function_call_output',
            output: JSON.stringify({ temperature: 72 }),
        });
        expect(result.at(-1)).toEqual({
            call_id: 'call_2',
            type: 'function_call_output',
            output: JSON.stringify({ ok: true }),
        });
    });
});
