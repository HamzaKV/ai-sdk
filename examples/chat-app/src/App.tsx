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

export function App() {
    const { messages, status, input, handleInputChange, handleSubmit } =
        useChat({ streamFn });

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
            </div>
            <form onSubmit={handleSubmit}>
                <input
                    value={input}
                    onChange={handleInputChange}
                    disabled={status === 'streaming'}
                    placeholder='Ask something…'
                />
                <button
                    type='submit'
                    disabled={status === 'streaming' || !input.trim()}
                >
                    Send
                </button>
            </form>
        </main>
    );
}
