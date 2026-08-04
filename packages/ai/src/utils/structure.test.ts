import { describe, it, expect } from 'vitest';
import { defineStructure } from './structure';

describe('defineStructure', () => {
    const answer = defineStructure({
        answer: { type: 'string', description: 'the answer to the question' },
        confidence: { type: 'number' },
    });

    it('describes the fields for embedding in a prompt', () => {
        expect(answer.describe()).toBe(
            '- answer (string, the answer to the question)\n- confidence (number)'
        );
    });

    it('parses a JSON object out of free-form model output', () => {
        const result = answer.parse('Here you go: {"answer": "Paris", "confidence": 0.9} thanks!');
        expect(result).toEqual({ answer: 'Paris', confidence: 0.9 });
    });

    it('throws when the output has no JSON object', () => {
        expect(() => answer.parse('no json here')).toThrow('Expected a JSON object');
    });

    it('throws when a required key is missing', () => {
        expect(() => answer.parse('{"answer": "Paris"}')).toThrow('Missing key "confidence"');
    });
});
