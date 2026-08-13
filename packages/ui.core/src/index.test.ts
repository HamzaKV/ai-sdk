import { describe, it, expect, vi } from 'vitest';
import { createChatCore, type ChatMessage } from './index';
import type { StreamEvent } from '@varlabs/ai/utils/streaming';

async function* gen(events: StreamEvent[]): AsyncGenerator<StreamEvent> {
    for (const event of events) yield event;
}

describe('createChatCore', () => {
    it('streams text deltas into an assistant message and finishes idle', async () => {
        const streamFn = vi
            .fn()
            .mockReturnValueOnce(
                gen([
                    { type: 'text-delta', delta: 'Hello ' },
                    { type: 'text-delta', delta: 'world' },
                    { type: 'done' },
                ]),
            );

        const chat = createChatCore({ streamFn });
        await chat.sendMessage('hi');

        const state = chat.getState();
        expect(state.status).toBe('idle');
        expect(
            state.messages.map((m) => ({ role: m.role, content: m.content })),
        ).toEqual([
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'Hello world' },
        ]);
    });

    it('notifies subscribers on every state change', async () => {
        const streamFn = vi
            .fn()
            .mockReturnValueOnce(
                gen([{ type: 'text-delta', delta: 'hi' }, { type: 'done' }]),
            );

        const chat = createChatCore({ streamFn });
        const seen: string[] = [];
        chat.subscribe((state) => seen.push(state.status));

        await chat.sendMessage('hello');

        expect(seen).toContain('streaming');
        expect(seen[seen.length - 1]).toBe('idle');
    });

    it('sets status to error on an error event', async () => {
        const streamFn = vi
            .fn()
            .mockReturnValueOnce(gen([{ type: 'error', message: 'boom' }]));

        const chat = createChatCore({ streamFn });
        await chat.sendMessage('hi');

        expect(chat.getState()).toMatchObject({
            status: 'error',
            error: 'boom',
        });
    });

    it('rejects sendMessage while a turn is already in flight', async () => {
        let resolveStream: () => void = () => {};
        const blocked = new Promise<void>((resolve) => {
            resolveStream = resolve;
        });

        async function* slowGen(): AsyncGenerator<StreamEvent> {
            yield { type: 'text-delta', delta: 'hi' };
            await blocked;
            yield { type: 'done' };
        }

        const streamFn = vi.fn().mockReturnValueOnce(slowGen());
        const chat = createChatCore({ streamFn });

        const first = chat.sendMessage('one');
        await expect(chat.sendMessage('two')).rejects.toThrow(
            'Cannot send a message',
        );

        resolveStream();
        await first;
    });

    it('auto-executes registered client tools and continues the same turn', async () => {
        const streamFn = vi
            .fn()
            .mockReturnValueOnce(
                gen([
                    {
                        type: 'client-tool-call',
                        toolCallId: 'call_1',
                        name: 'getLocation',
                        args: {},
                    },
                ]),
            )
            .mockReturnValueOnce(
                gen([
                    { type: 'text-delta', delta: 'You are in NYC' },
                    { type: 'done' },
                ]),
            );

        const getLocation = vi.fn().mockResolvedValue({ city: 'NYC' });
        const chat = createChatCore({ streamFn, clientTools: { getLocation } });

        await chat.sendMessage('where am I?');

        expect(getLocation).toHaveBeenCalledWith({});
        expect(streamFn).toHaveBeenCalledTimes(2);

        const state = chat.getState();
        expect(state.status).toBe('idle');
        const toolMessage = state.messages.find((m) => m.role === 'tool');
        expect(toolMessage?.content).toBe(JSON.stringify({ city: 'NYC' }));
        expect(
            state.messages.some(
                (m) => m.role === 'assistant' && m.content === 'You are in NYC',
            ),
        ).toBe(true);
    });

    it('errors when a client-tool-call has no registered executor', async () => {
        const streamFn = vi.fn().mockReturnValueOnce(
            gen([
                {
                    type: 'client-tool-call',
                    toolCallId: 'call_1',
                    name: 'unknownTool',
                    args: {},
                },
            ]),
        );

        const chat = createChatCore({ streamFn });
        await chat.sendMessage('hi');

        expect(chat.getState()).toMatchObject({ status: 'error' });
        expect(chat.getState().error).toContain('unknownTool');
    });

    it('pauses on hitl-pending and resumes with a fresh stream after approve', async () => {
        const streamFn = vi
            .fn()
            .mockReturnValueOnce(
                gen([
                    {
                        type: 'hitl-pending',
                        jobId: 'job_1',
                        toolCallId: 'call_1',
                        name: 'deleteAccount',
                        args: { id: 42 },
                    },
                ]),
            )
            .mockReturnValueOnce(
                gen([{ type: 'text-delta', delta: 'Done' }, { type: 'done' }]),
            );

        const deleteAccount = vi.fn().mockResolvedValue({ ok: true });
        const chat = createChatCore({
            streamFn,
            clientTools: { deleteAccount },
        });

        await chat.sendMessage('delete my account');
        expect(chat.getState().status).toBe('awaiting-approval');
        expect(chat.getState().pendingApproval).toMatchObject({
            jobId: 'job_1',
            name: 'deleteAccount',
        });

        await chat.approve();

        expect(deleteAccount).toHaveBeenCalledWith({ id: 42 });
        expect(streamFn).toHaveBeenCalledTimes(2);
        expect(chat.getState().status).toBe('idle');
        expect(chat.getState().pendingApproval).toBeUndefined();
    });

    it('records toolCalls on the assistant message and replays them (plus sibling results) on resume', async () => {
        const streamFn = vi
            .fn()
            .mockReturnValueOnce(
                gen([
                    {
                        type: 'hitl-pending',
                        jobId: 'job_1',
                        toolCallId: 'call_2',
                        name: 'deleteAccount',
                        args: { id: 42 },
                        siblingResults: [
                            {
                                toolCallId: 'call_1',
                                name: 'getWeather',
                                args: { location: 'NYC' },
                                result: { temperature: 72 },
                            },
                        ],
                    },
                ]),
            )
            .mockReturnValueOnce(
                gen([{ type: 'text-delta', delta: 'Done' }, { type: 'done' }]),
            );

        const deleteAccount = vi.fn().mockResolvedValue({ ok: true });
        const chat = createChatCore({
            streamFn,
            clientTools: { deleteAccount },
        });

        await chat.sendMessage('do stuff');

        const assistantMessage = chat
            .getState()
            .messages.find((m) => m.role === 'assistant');
        expect(assistantMessage?.toolCalls).toEqual([
            {
                toolCallId: 'call_1',
                name: 'getWeather',
                args: { location: 'NYC' },
            },
            { toolCallId: 'call_2', name: 'deleteAccount', args: { id: 42 } },
        ]);
        const siblingResultMessage = chat
            .getState()
            .messages.find((m) => m.toolCallId === 'call_1');
        expect(siblingResultMessage?.content).toBe(
            JSON.stringify({ temperature: 72 }),
        );

        await chat.approve();

        // ui.core appends a fresh empty assistant placeholder before invoking streamFn for the
        // resumed turn - filter it out, same as examples/chat-app's server.ts does.
        const resumedMessages: ChatMessage[] = streamFn.mock.calls[1][0].filter(
            (m: ChatMessage) =>
                m.content.trim().length > 0 ||
                m.role === 'tool' ||
                (m.toolCalls?.length ?? 0) > 0,
        );
        // [..., assistant(toolCalls), tool(call_1 sibling result), tool(call_2 approve result)]
        expect(resumedMessages.at(-3)).toMatchObject({
            role: 'assistant',
            toolCalls: [
                { toolCallId: 'call_1', name: 'getWeather' },
                { toolCallId: 'call_2', name: 'deleteAccount' },
            ],
        });
        expect(resumedMessages.at(-2)).toMatchObject({
            role: 'tool',
            toolCallId: 'call_1',
            content: JSON.stringify({ temperature: 72 }),
        });
        expect(resumedMessages.at(-1)).toMatchObject({
            role: 'tool',
            toolCallId: 'call_2',
            content: JSON.stringify({ ok: true }),
        });
    });

    it('lets approve() edit the tool args before executing', async () => {
        const streamFn = vi
            .fn()
            .mockReturnValueOnce(
                gen([
                    {
                        type: 'hitl-pending',
                        jobId: 'job_2',
                        toolCallId: 'call_2',
                        name: 'sendEmail',
                        args: { to: 'a@example.com' },
                    },
                ]),
            )
            .mockReturnValueOnce(gen([{ type: 'done' }]));

        const sendEmail = vi.fn().mockResolvedValue({ sent: true });
        const chat = createChatCore({ streamFn, clientTools: { sendEmail } });

        await chat.sendMessage('email someone');
        await chat.approve({ to: 'b@example.com' });

        expect(sendEmail).toHaveBeenCalledWith({ to: 'b@example.com' });
    });

    it('feeds a denial back as a tool result and continues the conversation', async () => {
        const streamFn = vi
            .fn()
            .mockReturnValueOnce(
                gen([
                    {
                        type: 'hitl-pending',
                        jobId: 'job_3',
                        toolCallId: 'call_3',
                        name: 'deleteAccount',
                        args: {},
                    },
                ]),
            )
            .mockReturnValueOnce(gen([{ type: 'done' }]));

        const deleteAccount = vi.fn();
        const chat = createChatCore({
            streamFn,
            clientTools: { deleteAccount },
        });

        await chat.sendMessage('delete my account');
        await chat.deny('not authorized');

        expect(deleteAccount).not.toHaveBeenCalled();
        const toolMessage = chat
            .getState()
            .messages.find((m) => m.role === 'tool');
        expect(JSON.parse(toolMessage?.content ?? '{}')).toEqual({
            error: 'denied',
            reason: 'not authorized',
        });
        expect(chat.getState().status).toBe('idle');
    });

    it('throws when approving or denying with nothing pending', async () => {
        const chat = createChatCore({ streamFn: vi.fn() });
        await expect(chat.approve()).rejects.toThrow('No pending approval');
        await expect(chat.deny()).rejects.toThrow('No pending approval');
    });

    it('runs beforeSend, onChunk, and onFinish middleware in order', async () => {
        const streamFn = vi
            .fn()
            .mockReturnValueOnce(
                gen([{ type: 'text-delta', delta: 'hi' }, { type: 'done' }]),
            );

        const beforeSend = vi.fn((m: ChatMessage) => ({
            ...m,
            content: `[redacted] ${m.content}`,
        }));
        const onChunk = vi.fn((e: StreamEvent) => e);
        const onFinish = vi.fn((m: ChatMessage) => ({
            ...m,
            content: `${m.content}!`,
        }));

        const chat = createChatCore({
            streamFn,
            middleware: [{ beforeSend, onChunk, onFinish }],
        });

        await chat.sendMessage('secret');

        expect(beforeSend).toHaveBeenCalled();
        expect(onChunk).toHaveBeenCalledTimes(2);
        expect(onFinish).toHaveBeenCalled();

        const state = chat.getState();
        expect(state.messages[0].content).toBe('[redacted] secret');
        expect(state.messages[1].content).toBe('hi!');
    });
});
