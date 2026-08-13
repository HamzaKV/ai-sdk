import { useChat } from '@varlabs/ai.ui-react';
import type { ChatMessage } from '@varlabs/ai.ui-core';
import {
    handleStreamResponse,
    type StreamEvent,
} from '@varlabs/ai/utils/streaming';
import './App.css';

// Talks to our own server.ts, not the model provider directly - the API key
// never reaches the browser. handleStreamResponse is the same utility the
// server uses to read a provider's stream, reused here to read ours.
async function* streamFn(messages: ChatMessage[]): AsyncGenerator<StreamEvent> {
    const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
    });

    if (!res.ok) {
        yield { type: 'error', message: `Server responded ${res.status}` };
        return;
    }

    yield* handleStreamResponse<StreamEvent>(res);
}

// Executed in the browser as soon as the model calls it - no approval needed (see
// server.ts's getLocation, registered with approval: 'auto'). Stand-in for a real
// navigator.geolocation call, kept deterministic for the example.
const getLocation = async () => ({ city: 'San Francisco' });

// Also executed in the browser, but only once the user clicks Approve below - ui.core calls
// this from approve(), not when the model first calls the tool (see server.ts's
// deleteAccount, registered with approval: 'required'). Demo only - doesn't delete anything.
const deleteAccount = async () => ({ ok: true });

export function App() {
    const {
        messages,
        status,
        pendingApproval,
        input,
        handleInputChange,
        handleSubmit,
        approve,
        deny,
    } = useChat({
        streamFn,
        clientTools: { getLocation, deleteAccount },
    });

    return (
        <main className='chat'>
            <h1>ai-sdk chat example</h1>
            <div className='messages'>
                {messages.map((m) => (
                    <p key={m.id} className={`message message-${m.role}`}>
                        <strong>{m.role}:</strong> {m.content}
                    </p>
                ))}
                {status === 'streaming' && <p className='status'>thinking…</p>}
                {status === 'error' && (
                    <p className='status status-error'>Something went wrong.</p>
                )}
                {status === 'awaiting-approval' && pendingApproval && (
                    <div className='approval'>
                        <p>
                            Approve <strong>{pendingApproval.name}</strong> with
                            args{' '}
                            <code>{JSON.stringify(pendingApproval.args)}</code>?
                        </p>
                        <button type='button' onClick={() => approve()}>
                            Approve
                        </button>
                        <button
                            type='button'
                            onClick={() => deny('User declined')}
                        >
                            Deny
                        </button>
                    </div>
                )}
            </div>
            <form onSubmit={handleSubmit}>
                <input
                    value={input}
                    onChange={handleInputChange}
                    disabled={
                        status === 'streaming' || status === 'awaiting-approval'
                    }
                    placeholder={
                        'Ask something… (try "what\'s the weather in Boston?" or "delete my account")'
                    }
                />
                <button
                    type='submit'
                    disabled={
                        status === 'streaming' ||
                        status === 'awaiting-approval' ||
                        !input.trim()
                    }
                >
                    Send
                </button>
            </form>
        </main>
    );
}
