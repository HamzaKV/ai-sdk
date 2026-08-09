# @varlabs/ai.evals

Dataset regression evals for the AI SDK: pluggable scorers (exact-match, embedding similarity, LLM-as-judge) that compose with your own vitest suite.

## Installation
```bash
npm install @varlabs/ai.evals
# or
yarn add @varlabs/ai.evals
# or
pnpm add @varlabs/ai.evals
```

## Usage

`runEvals` runs a dataset through your `run` function, scores each result, and averages the scores. `assertEvalsPass` throws inside a normal `it()`/`test()` block when the average is below your threshold, so evals live in your existing test suite - no custom runner.

```typescript
import { runEvals, assertEvalsPass, exactMatchScorer } from '@varlabs/ai.evals';

const dataset = [
  { name: 'capital of France', input: 'capital of France', expected: 'Paris' },
  { name: 'capital of Japan', input: 'capital of Japan', expected: 'Tokyo' },
];

const summary = await runEvals({
  dataset,
  run: (input) => myModelCall(input),
  scorer: exactMatchScorer(),
  threshold: 0.8,
});

assertEvalsPass(summary, 0.8);
```

Other scorers: `cosineSimilarityScorer(embed)` compares embedding similarity, and `llmJudgeScorer({ judge, rubric })` asks a model to grade the output on a 0-1 scale. Both take your own provider call as an argument, so they work with any provider.

## License
MIT
