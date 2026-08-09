import { describe, it, expect } from 'vitest';
import openAiProvider from './index';

// Live contract test: hits the real OpenAI API to catch upstream API drift that mocked
// tests can't. Skipped unless OPENAI_API_KEY is set - run manually or on a nightly job,
// never on every push (costs money, network-flaky).
describe.skipIf(!process.env.OPENAI_API_KEY)(
    'OpenAI Provider (live contract test)',
    () => {
        const openai = openAiProvider({
            config: {
                apiKey: process.env.OPENAI_API_KEY ?? '',
                baseUrl: 'https://api.openai.com/v1',
            },
        });

        it('creates a real embedding', async () => {
            const result = await openai.models.embedding.embed({
                model: 'text-embedding-3-small',
                text: 'hello world',
            });

            expect(result.data[0]?.embedding.length).toBeGreaterThan(0);
        }, 30000);
    },
);
