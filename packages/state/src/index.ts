export type StatePersistence<T = unknown> = {
    get(key: string): Promise<T | undefined>;
    set(key: string, value: T): Promise<void>;
    delete(key: string): Promise<void>;
};

export const createInMemoryStatePersistence = <
    T = unknown,
>(): StatePersistence<T> => {
    const store = new Map<string, T>();
    return {
        async get(key) {
            return store.get(key);
        },
        async set(key, value) {
            store.set(key, value);
        },
        async delete(key) {
            store.delete(key);
        },
    };
};

// A tool call paused mid-response, awaiting human approval before it runs.
export type PendingToolCall = {
    toolCallId: string;
    name: string;
    args: unknown;
};

export type HitlJobStatus = 'pending' | 'approved' | 'denied';

// Durable record of a paused conversation: enough state to re-invoke the provider
// and continue from where it left off, from any client/device, at any later time.
export type HitlJob<ConversationState = unknown> = {
    id: string;
    status: HitlJobStatus;
    conversationState: ConversationState;
    pendingToolCall: PendingToolCall;
    denyReason?: string;
    createdAt: number;
    updatedAt: number;
};

export const createHitlJob = <ConversationState>(input: {
    id: string;
    conversationState: ConversationState;
    pendingToolCall: PendingToolCall;
}): HitlJob<ConversationState> => {
    const now = Date.now();
    return {
        id: input.id,
        status: 'pending',
        conversationState: input.conversationState,
        pendingToolCall: input.pendingToolCall,
        createdAt: now,
        updatedAt: now,
    };
};

export type JobStore<ConversationState = unknown> = {
    create(input: {
        id: string;
        conversationState: ConversationState;
        pendingToolCall: PendingToolCall;
    }): Promise<HitlJob<ConversationState>>;
    get(id: string): Promise<HitlJob<ConversationState> | undefined>;
    // Approving optionally edits the tool call's args (the HITL "edit args before approving" flow).
    approve(
        id: string,
        args?: unknown,
    ): Promise<HitlJob<ConversationState> | undefined>;
    deny(
        id: string,
        reason?: string,
    ): Promise<HitlJob<ConversationState> | undefined>;
};

export const createJobStore = <ConversationState = unknown>(
    persistence: StatePersistence<HitlJob<ConversationState>>,
): JobStore<ConversationState> => {
    return {
        async create(input) {
            const job = createHitlJob(input);
            await persistence.set(job.id, job);
            return job;
        },
        async get(id) {
            return persistence.get(id);
        },
        async approve(id, args) {
            const job = await persistence.get(id);
            if (!job) return undefined;

            const updated: HitlJob<ConversationState> = {
                ...job,
                status: 'approved',
                pendingToolCall:
                    args !== undefined
                        ? { ...job.pendingToolCall, args }
                        : job.pendingToolCall,
                updatedAt: Date.now(),
            };
            await persistence.set(id, updated);
            return updated;
        },
        async deny(id, reason) {
            const job = await persistence.get(id);
            if (!job) return undefined;

            const updated: HitlJob<ConversationState> = {
                ...job,
                status: 'denied',
                denyReason: reason,
                updatedAt: Date.now(),
            };
            await persistence.set(id, updated);
            return updated;
        },
    };
};
