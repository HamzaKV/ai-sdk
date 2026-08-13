import { describe, it, expect } from 'vitest';
import { toAnthropicMessages, type ChatMessageLike } from './chat-messages';

describe('toAnthropicMessages', () => {
    it('passes plain user/assistant text through as strings', () => {
        const messages: ChatMessageLike[] = [
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'hello' },
        ];

        expect(toAnthropicMessages(messages)).toEqual([
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'hello' },
        ]);
    });

    it('drops the empty placeholder assistant message', () => {
        const messages: ChatMessageLike[] = [
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: '' },
        ];

        expect(toAnthropicMessages(messages)).toEqual([
            { role: 'user', content: 'hi' },
        ]);
    });

    it('turns an assistant message with toolCalls into text + tool_use blocks', () => {
        const messages: ChatMessageLike[] = [
            { role: 'user', content: 'weather?' },
            {
                role: 'assistant',
                content: 'Let me check.',
                toolCalls: [
                    {
                        toolCallId: 'toolu_1',
                        name: 'getWeather',
                        args: { location: 'NYC' },
                    },
                ],
            },
        ];

        expect(toAnthropicMessages(messages)).toEqual([
            { role: 'user', content: 'weather?' },
            {
                role: 'assistant',
                content: [
                    { type: 'text', text: 'Let me check.' },
                    {
                        type: 'tool_use',
                        id: 'toolu_1',
                        name: 'getWeather',
                        input: { location: 'NYC' },
                    },
                ],
            },
        ]);
    });

    it('omits the text block when the assistant said nothing before calling tools', () => {
        const messages: ChatMessageLike[] = [
            {
                role: 'assistant',
                content: '',
                toolCalls: [
                    { toolCallId: 'toolu_1', name: 'getWeather', args: {} },
                ],
            },
        ];

        expect(toAnthropicMessages(messages)).toEqual([
            {
                role: 'assistant',
                content: [
                    {
                        type: 'tool_use',
                        id: 'toolu_1',
                        name: 'getWeather',
                        input: {},
                    },
                ],
            },
        ]);
    });

    it('merges consecutive tool-role messages into one user message with multiple tool_result blocks', () => {
        const messages: ChatMessageLike[] = [
            {
                role: 'assistant',
                content: '',
                toolCalls: [
                    { toolCallId: 'toolu_1', name: 'getWeather', args: {} },
                    { toolCallId: 'toolu_2', name: 'deleteAccount', args: {} },
                ],
            },
            {
                role: 'tool',
                toolCallId: 'toolu_1',
                content: JSON.stringify({ temperature: 72 }),
            },
            {
                role: 'tool',
                toolCallId: 'toolu_2',
                content: JSON.stringify({ ok: true }),
            },
        ];

        const result = toAnthropicMessages(messages);
        expect(result).toHaveLength(2);
        expect(result[1]).toEqual({
            role: 'user',
            content: [
                {
                    type: 'tool_result',
                    tool_use_id: 'toolu_1',
                    content: JSON.stringify({ temperature: 72 }),
                },
                {
                    type: 'tool_result',
                    tool_use_id: 'toolu_2',
                    content: JSON.stringify({ ok: true }),
                },
            ],
        });
    });
});
