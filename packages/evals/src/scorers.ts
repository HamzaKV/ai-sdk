import { cosineSimilarity } from '@varlabs/ai/utils/cosine';

// A scorer compares actual output to expected output and returns 0 (no match) to 1 (perfect match).
export type Scorer<Output> = (output: Output, expected: Output) => Promise<number>;

export const exactMatchScorer = (options?: { caseSensitive?: boolean }): Scorer<string> => {
    const caseSensitive = options?.caseSensitive ?? true;
    return async (output, expected) => {
        const a = caseSensitive ? output.trim() : output.trim().toLowerCase();
        const b = caseSensitive ? expected.trim() : expected.trim().toLowerCase();
        return a === b ? 1 : 0;
    };
};

// App supplies the embedding call (wraps whichever provider's embedding model it uses).
export const cosineSimilarityScorer = (
    embed: (text: string) => Promise<number[]>
): Scorer<string> => {
    return async (output, expected) => {
        const [a, b] = await Promise.all([embed(output), embed(expected)]);
        // cosineSimilarity ranges [-1, 1]; clamp/rescale to a [0, 1] score.
        return Math.max(0, Math.min(1, (cosineSimilarity(a, b) + 1) / 2));
    };
};

const buildJudgePrompt = (output: string, expected: string, rubric?: string): string => {
    return [
        'You are grading how well an AI response matches the expected answer.',
        rubric ? `Rubric: ${rubric}` : undefined,
        `Expected answer: ${expected}`,
        `Actual answer: ${output}`,
        'Respond with only a number between 0 and 1 (e.g. "0.8") representing how well the actual answer matches the expected answer.',
    ].filter(Boolean).join('\n');
};

// App supplies the judge call (wraps whichever provider's text model it uses as the judge).
export const llmJudgeScorer = (options: {
    judge: (prompt: string) => Promise<string>;
    rubric?: string;
}): Scorer<string> => {
    return async (output, expected) => {
        const response = await options.judge(buildJudgePrompt(output, expected, options.rubric));
        const score = Number.parseFloat(response.trim());
        if (Number.isNaN(score)) {
            throw new Error(`LLM judge did not return a parseable score: "${response}"`);
        }
        return Math.max(0, Math.min(1, score));
    };
};
