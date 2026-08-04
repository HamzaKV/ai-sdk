import type { Scorer } from './scorers.js';

export type EvalCase<Input, Output> = {
    name: string;
    input: Input;
    expected: Output;
};

export type EvalResult<Input, Output> = {
    name: string;
    input: Input;
    expected: Output;
    actual: Output;
    score: number;
};

export type EvalRunSummary<Input, Output> = {
    results: EvalResult<Input, Output>[];
    averageScore: number;
    passed: boolean;
};

export type RunEvalsOptions<Input, Output> = {
    dataset: EvalCase<Input, Output>[];
    run: (input: Input) => Promise<Output>;
    scorer: Scorer<Output>;
    // Minimum average score to be considered passing. Defaults to 1 (exact match on average).
    threshold?: number;
};

export const runEvals = async <Input, Output>(
    options: RunEvalsOptions<Input, Output>
): Promise<EvalRunSummary<Input, Output>> => {
    const threshold = options.threshold ?? 1;
    const results: EvalResult<Input, Output>[] = [];

    for (const testCase of options.dataset) {
        const actual = await options.run(testCase.input);
        const score = await options.scorer(actual, testCase.expected);
        results.push({ name: testCase.name, input: testCase.input, expected: testCase.expected, actual, score });
    }

    const averageScore = results.length
        ? results.reduce((sum, r) => sum + r.score, 0) / results.length
        : 0;

    return { results, averageScore, passed: averageScore >= threshold };
};

// Throws (failing whatever `it()` block calls this) when the run's average score is
// below the given threshold - this is the whole "wire into vitest" story: no custom
// runner, just call this inside a normal test.
export const assertEvalsPass = <Input, Output>(
    summary: EvalRunSummary<Input, Output>,
    threshold: number
): void => {
    if (summary.averageScore >= threshold) return;

    const failing = summary.results
        .filter((r) => r.score < threshold)
        .map((r) => `${r.name} (score ${r.score.toFixed(2)})`)
        .join(', ');

    throw new Error(
        `Eval average score ${summary.averageScore.toFixed(2)} is below threshold ${threshold}. Failing cases: ${failing}`
    );
};
