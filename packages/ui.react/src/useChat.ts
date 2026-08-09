import { useRef, useState, useCallback, useSyncExternalStore } from 'react';
import {
    createChatCore,
    type CreateChatCoreOptions,
    type ChatState,
} from '@varlabs/ai.ui-core';

export type UseChatOptions = CreateChatCoreOptions;

export const useChat = (options: UseChatOptions) => {
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const coreRef = useRef<ReturnType<typeof createChatCore> | undefined>(
        undefined,
    );
    if (!coreRef.current) {
        // Created once, options read via the ref above so later renders' closures stay fresh
        // without recreating the underlying store (mirrors useChat's usual behavior).
        coreRef.current = createChatCore({
            streamFn: (messages) => optionsRef.current.streamFn(messages),
            clientTools: options.clientTools,
            jobStore: options.jobStore,
            middleware: options.middleware,
            generateId: options.generateId,
        });
    }
    const core = coreRef.current;

    const state = useSyncExternalStore<ChatState>(
        core.subscribe,
        core.getState,
        core.getState,
    );

    const [input, setInput] = useState('');

    const handleSubmit = useCallback(
        (event?: { preventDefault?: () => void }) => {
            event?.preventDefault?.();
            if (!input.trim()) return;
            const content = input;
            setInput('');
            void core.sendMessage(content);
        },
        [core, input],
    );

    const handleInputChange = useCallback(
        (event: { target: { value: string } }) => {
            setInput(event.target.value);
        },
        [],
    );

    return {
        messages: state.messages,
        status: state.status,
        pendingApproval: state.pendingApproval,
        error: state.error,
        input,
        setInput,
        handleInputChange,
        handleSubmit,
        sendMessage: core.sendMessage,
        approve: core.approve,
        deny: core.deny,
    };
};
