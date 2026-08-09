# @varlabs/ai.signatures

DSPy/ax-style typed signatures and a ReAct agent loop for the AI SDK: a typed input/output spec that compiles into a prompt and parses the model's response back into the declared shape - no hand-written prompt strings.

## Installation
```bash
npm install @varlabs/ai.signatures
# or
yarn add @varlabs/ai.signatures
# or
pnpm add @varlabs/ai.signatures
```

## Usage

### Signatures

```typescript
import { defineSignature } from '@varlabs/ai.signatures';

const qa = defineSignature({
  input: { question: { type: 'string' } },
  output: { answer: { type: 'string' } },
  instructions: 'Answer the question concisely.',
});

const prompt = qa.compilePrompt({ question: 'What is the capital of France?' });
const modelResponse = await myModelCall(prompt);
const { answer } = qa.parseOutput(modelResponse);
```

### ReAct agent

`runReActAgent` loops a signature plus a tool set until the model produces the signature's final output (or `maxSteps` is exceeded). Server-located tools run inline; client-located tools are handed to `onClientToolCall`.

```typescript
import { runReActAgent } from '@varlabs/ai.signatures';

const result = await runReActAgent(
  {
    signature: qa,
    tools: { search: mySearchTool },
    callModel: (prompt) => myModelCall(prompt),
  },
  { question: 'What is the capital of France?' },
);
```

## License
MIT
