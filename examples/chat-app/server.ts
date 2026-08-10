import {
    createServer,
    type IncomingMessage,
    type ServerResponse,
} from 'node:http';
import { createAIClient } from '@varlabs/ai';
import openAiProvider from '@varlabs/ai.openai';
import {
    createDataStream,
    pipeStreamToResponse,
    type StreamEvent,
} from '@varlabs/ai/utils/streaming';
import type { ChatMessage } from '@varlabs/ai.ui-core';

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

const readJsonBody = async (
    req: IncomingMessage,
): Promise<{ messages: ChatMessage[] }> => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
};

const handleChat = async (req: IncomingMessage, res: ServerResponse) => {
    const { messages } = await readJsonBody(req);

    // ui.core appends an empty assistant placeholder before calling streamFn -
    // drop it, and anything else with no content, before sending to the model.
    const input = messages
        .filter(
            (m): m is ChatMessage & { role: 'user' | 'assistant' } =>
                m.content.trim().length > 0 && m.role !== 'tool',
        )
        .map((m) => ({
            type: 'message' as const,
            role: m.role,
            content: m.content,
        }));

    // stream_response already yields normalized StreamEvents - no per-app mapping needed.
    const events = await client.openai.text.stream_response({
        model: 'gpt-4o-mini',
        input,
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
    res.writeHead(404).end('Not found');
});

const port = 3001;
server.listen(port, () => {
    console.log(`Chat API listening on http://localhost:${port}`);
});
