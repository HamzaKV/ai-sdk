import { describe, it, expect } from 'vitest';
import { defineSignature } from './signature.js';

describe('defineSignature', () => {
    const qa = defineSignature({
        instructions: 'Answer the question concisely.',
        input: { question: { type: 'string' } },
        output: { answer: { type: 'string', description: 'the answer' } },
    });

    it('compiles a prompt containing the instructions, inputs, and expected output fields', () => {
        const prompt = qa.compilePrompt({
            question: 'What is the capital of France?',
        });

        expect(prompt).toContain('Answer the question concisely.');
        expect(prompt).toContain('question: "What is the capital of France?"');
        expect(prompt).toContain('- answer (string, the answer)');
        expect(prompt).toContain('Respond with ONLY the JSON object');
    });

    it('parses the model response into the typed output', () => {
        const output = qa.parseOutput('{"answer": "Paris"}');
        expect(output).toEqual({ answer: 'Paris' });
    });

    it('throws when the response is missing a required output field', () => {
        expect(() => qa.parseOutput('{}')).toThrow('Missing key "answer"');
    });
});
