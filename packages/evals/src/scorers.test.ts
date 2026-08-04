import { describe, it, expect } from 'vitest';
import { exactMatchScorer, cosineSimilarityScorer, llmJudgeScorer } from './scorers.js';

describe('exactMatchScorer', () => {
    it('scores 1 for an exact match', async () => {
        const score = await exactMatchScorer()('Paris', 'Paris');
        expect(score).toBe(1);
    });

    it('scores 0 for a mismatch', async () => {
        const score = await exactMatchScorer()('Paris', 'London');
        expect(score).toBe(0);
    });

    it('trims whitespace before comparing', async () => {
        const score = await exactMatchScorer()('  Paris  ', 'Paris');
        expect(score).toBe(1);
    });

    it('is case-sensitive by default', async () => {
        expect(await exactMatchScorer()('paris', 'Paris')).toBe(0);
    });

    it('can be made case-insensitive', async () => {
        expect(await exactMatchScorer({ caseSensitive: false })('paris', 'Paris')).toBe(1);
    });
});

describe('cosineSimilarityScorer', () => {
    it('scores 1 for identical embeddings', async () => {
        const embed = async (text: string) => (text === 'a' ? [1, 0, 0] : [1, 0, 0]);
        const score = await cosineSimilarityScorer(embed)('a', 'b');
        expect(score).toBe(1);
    });

    it('scores 0 for opposite embeddings', async () => {
        const embed = async (text: string) => (text === 'a' ? [1, 0, 0] : [-1, 0, 0]);
        const score = await cosineSimilarityScorer(embed)('a', 'b');
        expect(score).toBe(0);
    });

    it('scores 0.5 for orthogonal embeddings', async () => {
        const embed = async (text: string) => (text === 'a' ? [1, 0, 0] : [0, 1, 0]);
        const score = await cosineSimilarityScorer(embed)('a', 'b');
        expect(score).toBeCloseTo(0.5);
    });
});

describe('llmJudgeScorer', () => {
    it('parses a numeric score from the judge response', async () => {
        const judge = async () => '0.75';
        const score = await llmJudgeScorer({ judge })('actual', 'expected');
        expect(score).toBe(0.75);
    });

    it('clamps scores outside [0, 1]', async () => {
        const judge = async () => '1.5';
        const score = await llmJudgeScorer({ judge })('actual', 'expected');
        expect(score).toBe(1);
    });

    it('throws when the judge response is not a number', async () => {
        const judge = async () => 'definitely not a number';
        await expect(llmJudgeScorer({ judge })('actual', 'expected')).rejects.toThrow('not return a parseable score');
    });

    it('includes the rubric in the prompt sent to the judge', async () => {
        let capturedPrompt = '';
        const judge = async (prompt: string) => {
            capturedPrompt = prompt;
            return '1';
        };
        await llmJudgeScorer({ judge, rubric: 'Must mention the capital city' })('actual', 'expected');
        expect(capturedPrompt).toContain('Must mention the capital city');
    });
});
