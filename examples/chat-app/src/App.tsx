import { useState } from 'react';
import { useChat } from '@varlabs/ai.ui-react';
import type { ChatMessage } from '@varlabs/ai.ui-core';
import type { JobStore } from '@varlabs/ai.state';
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

// Proxies to server.ts's job routes instead of the browser-default in-memory jobStore, which
// is private to this one tab/instance. Routing through the server (shared across every tab
// hitting it) is what makes resumeFromJob a genuine cross-tab/cross-device demo below, not
// just same-tab plumbing.
const httpJobStore: JobStore<ChatMessage[]> = {
    async create(input) {
        const res = await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        return res.json();
    },
    async get(id) {
        const res = await fetch(`/api/jobs/${id}`);
        return res.ok ? res.json() : undefined;
    },
    async approve(id, args) {
        const res = await fetch(`/api/jobs/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ args }),
        });
        return res.ok ? res.json() : undefined;
    },
    async deny(id, reason) {
        const res = await fetch(`/api/jobs/${id}/deny`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });
        return res.ok ? res.json() : undefined;
    },
};

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
        resumeFromJob,
    } = useChat({
        streamFn,
        clientTools: { getLocation, deleteAccount },
        jobStore: httpJobStore,
    });

    const [resumeJobId, setResumeJobId] = useState('');
    const [resumeError, setResumeError] = useState('');

    const handleResume = async (event: { preventDefault?: () => void }) => {
        event.preventDefault?.();
        if (!resumeJobId.trim()) return;
        setResumeError('');
        try {
            await resumeFromJob(resumeJobId.trim());
        } catch (err) {
            setResumeError(err instanceof Error ? err.message : String(err));
        }
    };

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
                        <p className='job-id'>
                            Job ID (paste into another tab's resume box to
                            approve from there):{' '}
                            <code>{pendingApproval.jobId}</code>
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
            <form className='resume-form' onSubmit={handleResume}>
                <input
                    value={resumeJobId}
                    onChange={(e) => setResumeJobId(e.target.value)}
                    disabled={status !== 'idle' && status !== 'error'}
                    placeholder='Resume a pending job by ID…'
                />
                <button
                    type='submit'
                    disabled={
                        (status !== 'idle' && status !== 'error') ||
                        !resumeJobId.trim()
                    }
                >
                    Resume
                </button>
                {resumeError && (
                    <p className='status status-error'>{resumeError}</p>
                )}
            </form>
        </main>
    );
}
