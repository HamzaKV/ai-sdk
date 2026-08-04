import { describe, it, expect } from 'vitest';
import { runEvals, assertEvalsPass } from './runner.js';
import { exactMatchScorer } from './scorers.js';

describe('runEvals', () => {
    it('runs each case through run() and scorer(), and averages the scores', async () => {
        const dataset = [
            { name: 'case 1', input: 'capital of France', expected: 'Paris' },
            { name: 'case 2', input: 'capital of Japan', expected: 'Tokyo' },
        ];

        const run = async (input: string) => (input.includes('France') ? 'Paris' : 'Osaka');

        const summary = await runEvals({ dataset, run, scorer: exactMatchScorer() });

        expect(summary.results).toHaveLength(2);
        expect(summary.results[0]).toMatchObject({ name: 'case 1', actual: 'Paris', score: 1 });
        expect(summary.results[1]).toMatchObject({ name: 'case 2', actual: 'Osaka', score: 0 });
        expect(summary.averageScore).toBe(0.5);
    });

    it('passes when average score meets the threshold', async () => {
        const dataset = [{ name: 'only case', input: 'x', expected: 'x' }];
        const summary = await runEvals({ dataset, run: async (i: string) => i, scorer: exactMatchScorer(), threshold: 0.5 });
        expect(summary.passed).toBe(true);
    });

    it('fails when average score is below the threshold', async () => {
        const dataset = [{ name: 'only case', input: 'x', expected: 'y' }];
        const summary = await runEvals({ dataset, run: async (i: string) => i, scorer: exactMatchScorer(), threshold: 0.5 });
        expect(summary.passed).toBe(false);
    });

    it('defaults averageScore to 0 for an empty dataset', async () => {
        const summary = await runEvals({ dataset: [], run: async () => '', scorer: exactMatchScorer() });
        expect(summary.averageScore).toBe(0);
    });
});

describe('assertEvalsPass', () => {
    it('does not throw when average score meets the threshold', () => {
        expect(() => assertEvalsPass({ results: [], averageScore: 0.9, passed: true }, 0.8)).not.toThrow();
    });

    it('throws listing failing cases when below threshold', () => {
        const summary = {
            results: [
                { name: 'good', input: '', expected: '', actual: '', score: 1 },
                { name: 'bad', input: '', expected: '', actual: '', score: 0.2 },
            ],
            averageScore: 0.6,
            passed: false,
        };

        expect(() => assertEvalsPass(summary, 0.8)).toThrow(/bad \(score 0\.20\)/);
    });
});
