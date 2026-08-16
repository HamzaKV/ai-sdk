import {
    createServer,
    type IncomingMessage,
    type ServerResponse,
} from 'node:http';
import { createAIClient } from '@varlabs/ai';
import openAiProvider, { customTool } from '@varlabs/ai.openai';
import { toOpenAiInput } from '@varlabs/ai.openai/chat-messages';
import {
    createDataStream,
    pipeStreamToResponse,
    type StreamEvent,
} from '@varlabs/ai/utils/streaming';
import type { ChatMessage } from '@varlabs/ai.ui-core';
import {
    createJobStore,
    createInMemoryStatePersistence,
    type HitlJob,
} from '@varlabs/ai.state';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    throw new Error(
        'Set OPENAI_API_KEY (see .env.example) before running the example server.',
    );
}

const client = createAIClient({
    providers: {
        openai: openAiProvider({
            config: { apiKey, baseUrl: 'https://api.openai.com/v1' },
        }),
    },
});

// Server-located: the SDK executes this itself, mid-stream, and the model's turn continues
// automatically - no browser round-trip. Fake data, so the example needs no extra API key.
const getWeather = customTool({
    location: 'server',
    description: 'Get the current weather for a city',
    parameters: {
        type: 'object',
        properties: {
            city: { type: 'string', description: 'City name' },
        },
        required: ['city'],
    },
    execute: async ({ city }: { city: string }) => ({
        city,
        temperature: 68,
        conditions: 'partly cloudy',
    }),
});

// Client-located, auto-approved: the browser executes it as soon as the model calls it (see
// App.tsx's clientTools.getLocation), no user interaction required.
const getLocation = customTool({
    location: 'client',
    approval: 'auto',
    description: "Get the user's current location",
    parameters: { type: 'object', properties: {} },
});

// Client-located, requires approval: pauses the turn (ChatState.status becomes
// 'awaiting-approval') until the user clicks Approve/Deny in the browser.
const deleteAccount = customTool({
    location: 'client',
    approval: 'required',
    description:
        "Delete the user's account - destructive, needs explicit confirmation",
    parameters: { type: 'object', properties: {} },
});

const readJsonBody = async (req: IncomingMessage): Promise<any> => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
};

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
};

// Server-side job store, shared across every browser tab hitting this dev server - unlike the
// browser-default in-memory jobStore (private to one ChatCore instance), this is what actually
// makes cross-tab/cross-device HITL resume possible: approve a job paused in tab A from tab B.
const jobStore = createJobStore(
    createInMemoryStatePersistence<HitlJob<ChatMessage[]>>(),
);

const handleJobs = async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '';

    if (req.method === 'POST' && url === '/api/jobs') {
        const job = await jobStore.create(await readJsonBody(req));
        return sendJson(res, 200, job);
    }

    const approveMatch = url.match(/^\/api\/jobs\/([^/]+)\/approve$/);
    if (req.method === 'POST' && approveMatch) {
        const { args } = await readJsonBody(req);
        const job = await jobStore.approve(approveMatch[1], args);
        return job
            ? sendJson(res, 200, job)
            : sendJson(res, 404, { error: 'not found' });
    }

    const denyMatch = url.match(/^\/api\/jobs\/([^/]+)\/deny$/);
    if (req.method === 'POST' && denyMatch) {
        const { reason } = await readJsonBody(req);
        const job = await jobStore.deny(denyMatch[1], reason);
        return job
            ? sendJson(res, 200, job)
            : sendJson(res, 404, { error: 'not found' });
    }

    const getMatch = url.match(/^\/api\/jobs\/([^/]+)$/);
    if (req.method === 'GET' && getMatch) {
        const job = await jobStore.get(getMatch[1]);
        return job
            ? sendJson(res, 200, job)
            : sendJson(res, 404, { error: 'not found' });
    }

    sendJson(res, 404, { error: 'not found' });
};

const handleChat = async (req: IncomingMessage, res: ServerResponse) => {
    const { messages } = await readJsonBody(req);

    // Translates ChatMessage[] (incl. toolCalls + tool-role results) into the Responses API's
    // input array - also handles ui.core's empty placeholder assistant message.
    const input = toOpenAiInput(messages);

    // stream_response already yields normalized StreamEvents - no per-app mapping needed.
    const events = await client.openai.text.stream_response({
        model: 'gpt-4o-mini',
        input,
        custom_tools: { getWeather, getLocation, deleteAccount },
    });

    const stream = createDataStream<StreamEvent>({
        execute: async ({ merge }) => {
            await merge(events);
        },
    });

    await pipeStreamToResponse(stream, res);
};

const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/chat') {
        handleChat(req, res).catch((err) => {
            console.error(err);
            res.writeHead(500).end('Internal error');
        });
        return;
    }
    if (req.url?.startsWith('/api/jobs')) {
        handleJobs(req, res).catch((err) => {
            console.error(err);
            res.writeHead(500).end('Internal error');
        });
        return;
    }
    res.writeHead(404).end('Not found');
});

const port = 3001;
server.listen(port, () => {
    console.log(`Chat API listening on http://localhost:${port}`);
});
