import { describe, it, expect } from 'vitest';
import anthropicProvider from './index';

// Live contract test: hits the real Anthropic API to catch upstream API drift that mocked
// tests can't. Skipped unless ANTHROPIC_API_KEY is set - run manually or on a nightly job,
// never on every push (costs money, network-flaky).
describe.skipIf(!process.env.ANTHROPIC_API_KEY)('Anthropic Provider (live contract test)', () => {
    const anthropic = anthropicProvider({
        config: {
            apiKey: process.env.ANTHROPIC_API_KEY ?? '',
            baseUrl: 'https://api.anthropic.com/v1',
            apiVersion: '2023-06-01',
        },
    });

    it('sends a real message', async () => {
        const result = await anthropic.models.claude.messages({
            model: 'claude-3-5-haiku-latest',
            messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
            max_tokens: 16,
        });

        expect(result.content.length).toBeGreaterThan(0);
    }, 30000);
});
