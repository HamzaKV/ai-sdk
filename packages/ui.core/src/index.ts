import type { StreamEvent } from '@varlabs/ai/utils/streaming';
import {
    createJobStore,
    createInMemoryStatePersistence,
    type JobStore,
    type HitlJob,
} from '@varlabs/ai.state';

export type ChatMessage = {
    id: string;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolCallId?: string;
    // Tool calls this assistant message made, if any - needed to replay a valid turn back to
    // the provider on resume (approve/deny), since providers require the original tool_use /
    // function_call block(s) to be echoed alongside each matching tool-role result.
    toolCalls?: { toolCallId: string; name: string; args: unknown }[];
};

export type ChatStatus = 'idle' | 'streaming' | 'awaiting-approval' | 'error';

export type PendingApproval = {
    jobId: string;
    toolCallId: string;
    name: string;
    args: unknown;
};

export type ChatState = {
    messages: ChatMessage[];
    status: ChatStatus;
    pendingApproval?: PendingApproval;
    error?: string;
};

// Fixed lifecycle points a UI middleware can observe and transform data at.
// Unlike server middleware (a gate: continue/stop), these always return a value.
export type UiMiddleware = {
    beforeSend?: (message: ChatMessage) => ChatMessage | Promise<ChatMessage>;
    onChunk?: (event: StreamEvent) => StreamEvent | Promise<StreamEvent>;
    onFinish?: (message: ChatMessage) => ChatMessage | Promise<ChatMessage>;
};

// Supplied by the app: given the current message history, returns the provider's
// normalized StreamEvent stream. Transport-agnostic - ui.core never calls fetch itself.
export type StreamFn = (messages: ChatMessage[]) => AsyncGenerator<StreamEvent>;

export type ClientToolExecutor = (args: unknown) => Promise<unknown>;

export type CreateChatCoreOptions = {
    streamFn: StreamFn;
    // Tools the client executes automatically as soon as the model calls them.
    clientTools?: Record<string, ClientToolExecutor>;
    // Tools that must be approved before the client executes them (see approve/deny below).
    // Durable across reload via jobStore - if omitted, an in-memory one is used.
    jobStore?: JobStore<ChatMessage[]>;
    middleware?: UiMiddleware[];
    generateId?: () => string;
};

export type ChatCore = {
    getState(): ChatState;
    subscribe(listener: (state: ChatState) => void): () => void;
    sendMessage(content: string): Promise<void>;
    approve(args?: unknown): Promise<void>;
    deny(reason?: string): Promise<void>;
    // Rehydrates state from a durable jobStore entry - for a fresh ChatCore (reload, new tab,
    // different device) that didn't itself pause the turn. approve()/deny() work unmodified
    // once this populates messages/pendingApproval.
    resumeFromJob(jobId: string): Promise<void>;
};

let fallbackIdCounter = 0;
const defaultGenerateId = () => `msg_${Date.now()}_${++fallbackIdCounter}`;

const runMiddlewareChain = async <T>(
    value: T,
    steps: Array<((value: T) => T | Promise<T>) | undefined>,
): Promise<T> => {
    let result = value;
    for (const step of steps) {
        if (!step) continue;
        result = await step(result);
    }
    return result;
};

export const createChatCore = (options: CreateChatCoreOptions): ChatCore => {
    const generateId = options.generateId ?? defaultGenerateId;
    const middleware = options.middleware ?? [];
    const clientTools = options.clientTools ?? {};
    const jobStore =
        options.jobStore ??
        createJobStore(
            createInMemoryStatePersistence<HitlJob<ChatMessage[]>>(),
        );

    let state: ChatState = { messages: [], status: 'idle' };
    const listeners = new Set<(state: ChatState) => void>();

    const setState = (next: Partial<ChatState>) => {
        state = { ...state, ...next };
        for (const listener of listeners) listener(state);
    };

    const upsertMessage = (message: ChatMessage) => {
        const index = state.messages.findIndex((m) => m.id === message.id);
        const messages =
            index === -1
                ? [...state.messages, message]
                : state.messages.map((m, i) => (i === index ? message : m));
        setState({ messages });
    };

    // client-tool-call/hitl-pending carry the sibling server-tool calls from the same round
    // (see StreamEvent.siblingResults) - the assistant message needs all of them recorded so a
    // resumed turn can replay the full round, not just the paused/auto-executed call.
    const toolCallsFromEvent = (event: {
        toolCallId: string;
        name: string;
        args: unknown;
        siblingResults?: { toolCallId: string; name: string; args: unknown }[];
    }): ChatMessage['toolCalls'] => [
        ...(event.siblingResults ?? []).map(({ toolCallId, name, args }) => ({
            toolCallId,
            name,
            args,
        })),
        { toolCallId: event.toolCallId, name: event.name, args: event.args },
    ];

    const appendSiblingResults = (
        siblingResults?: { toolCallId: string; result: unknown }[],
    ) => {
        for (const sibling of siblingResults ?? []) {
            upsertMessage({
                id: generateId(),
                role: 'tool',
                toolCallId: sibling.toolCallId,
                content: JSON.stringify(sibling.result),
            });
        }
    };

    const runTurn = async (): Promise<void> => {
        setState({ status: 'streaming', error: undefined });

        let assistant: ChatMessage = {
            id: generateId(),
            role: 'assistant',
            content: '',
        };
        upsertMessage(assistant);

        for await (const rawEvent of options.streamFn(state.messages)) {
            const event = await runMiddlewareChain(rawEvent, [
                ...middleware.map((m) => m.onChunk),
            ]);

            if (event.type === 'text-delta') {
                assistant = {
                    ...assistant,
                    content: assistant.content + event.delta,
                };
                upsertMessage(assistant);
                continue;
            }

            if (event.type === 'error') {
                setState({ status: 'error', error: event.message });
                return;
            }

            if (event.type === 'done') {
                assistant = await runMiddlewareChain(assistant, [
                    ...middleware.map((m) => m.onFinish),
                ]);
                upsertMessage(assistant);
                setState({ status: 'idle' });
                return;
            }

            if (event.type === 'client-tool-call') {
                const executor = clientTools[event.name];
                if (!executor) {
                    setState({
                        status: 'error',
                        error: `No client tool registered for "${event.name}"`,
                    });
                    return;
                }
                assistant = {
                    ...assistant,
                    toolCalls: toolCallsFromEvent(event),
                };
                upsertMessage(assistant);
                appendSiblingResults(event.siblingResults);

                const result = await executor(event.args);
                upsertMessage({
                    id: generateId(),
                    role: 'tool',
                    toolCallId: event.toolCallId,
                    content: JSON.stringify(result),
                });
                return runTurn();
            }

            if (event.type === 'hitl-pending') {
                assistant = {
                    ...assistant,
                    toolCalls: toolCallsFromEvent(event),
                };
                upsertMessage(assistant);
                appendSiblingResults(event.siblingResults);

                await jobStore.create({
                    id: event.jobId,
                    conversationState: state.messages,
                    pendingToolCall: {
                        toolCallId: event.toolCallId,
                        name: event.name,
                        args: event.args,
                    },
                });
                setState({
                    status: 'awaiting-approval',
                    pendingApproval: {
                        jobId: event.jobId,
                        toolCallId: event.toolCallId,
                        name: event.name,
                        args: event.args,
                    },
                });
                return;
            }
        }

        // Stream ended without an explicit 'done' - treat as finished defensively.
        setState({ status: 'idle' });
    };

    const resolvePendingApproval = async (
        result: unknown,
        toolCallId: string,
    ): Promise<void> => {
        upsertMessage({
            id: generateId(),
            role: 'tool',
            toolCallId,
            content: JSON.stringify(result),
        });
        setState({ pendingApproval: undefined });
        await runTurn();
    };

    return {
        getState: () => state,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        async sendMessage(content) {
            if (state.status !== 'idle' && state.status !== 'error') {
                throw new Error(
                    `Cannot send a message while status is "${state.status}"`,
                );
            }
            // Flip to 'streaming' synchronously (before any await) so a second call made
            // before this one yields to the event loop is rejected by the check above.
            setState({ status: 'streaming', error: undefined });

            const message = await runMiddlewareChain(
                { id: generateId(), role: 'user' as const, content },
                [...middleware.map((m) => m.beforeSend)],
            );
            upsertMessage(message);
            await runTurn();
        },
        async approve(args) {
            const pending = state.pendingApproval;
            if (!pending) throw new Error('No pending approval to approve');

            const job = await jobStore.approve(pending.jobId, args);
            const executor = clientTools[pending.name];
            if (!executor) {
                setState({
                    status: 'error',
                    error: `No client tool registered for "${pending.name}"`,
                });
                return;
            }

            const result = await executor(
                job?.pendingToolCall.args ?? pending.args,
            );
            await resolvePendingApproval(result, pending.toolCallId);
        },
        async deny(reason) {
            const pending = state.pendingApproval;
            if (!pending) throw new Error('No pending approval to deny');

            await jobStore.deny(pending.jobId, reason);
            await resolvePendingApproval(
                { error: 'denied', reason },
                pending.toolCallId,
            );
        },
        async resumeFromJob(jobId) {
            if (state.status !== 'idle' && state.status !== 'error') {
                throw new Error(
                    `Cannot resume while status is "${state.status}"`,
                );
            }

            const job = await jobStore.get(jobId);
            if (!job) throw new Error(`No job found for id "${jobId}"`);
            if (job.status !== 'pending') {
                throw new Error(
                    `Job "${jobId}" is not pending (status: "${job.status}")`,
                );
            }

            setState({
                messages: job.conversationState,
                status: 'awaiting-approval',
                error: undefined,
                pendingApproval: {
                    jobId: job.id,
                    toolCallId: job.pendingToolCall.toolCallId,
                    name: job.pendingToolCall.name,
                    args: job.pendingToolCall.args,
                },
            });
        },
    };
};
