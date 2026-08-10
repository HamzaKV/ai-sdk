import {
    createServer,
    type IncomingMessage,
    type ServerResponse,
} from 'node:http';
import { createAIClient } from '@varlabs/ai';
import openAiProvider from '@varlabs/ai.openai';
import {
    mapToStreamEvents,
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

// The Responses API's real streaming event shape - not what provider.openai's
// own types claim for stream_response (see ai-sdk gap-scan notes). Only the
// two event types this demo cares about are modeled.
type OpenAiStreamChunk = {
    type: string;
    delta?: string;
};

const mapChunk = (chunk: OpenAiStreamChunk): StreamEvent | undefined => {
    switch (chunk.type) {
        case 'response.output_text.delta':
            return { type: 'text-delta', delta: chunk.delta ?? '' };
        case 'response.completed':
        case 'response.incomplete':
            return { type: 'done' };
        case 'error':
            return { type: 'error', message: 'The model stream failed.' };
        default:
            return undefined;
    }
};

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

    const rawStream = await client.openai.text.stream_response({
        model: 'gpt-4o-mini',
        input,
    });

    const stream = createDataStream<StreamEvent>({
        execute: async ({ merge }) => {
            await merge(
                mapToStreamEvents(
                    rawStream as AsyncGenerator<OpenAiStreamChunk>,
                    mapChunk,
                ),
            );
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
