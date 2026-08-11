import { describe, it, expect } from 'vitest';
import { defineStructure } from './structure';

describe('defineStructure', () => {
    const answer = defineStructure({
        answer: { type: 'string', description: 'the answer to the question' },
        confidence: { type: 'number' },
    });

    it('describes the fields for embedding in a prompt', () => {
        expect(answer.describe()).toBe(
            '- answer (string, the answer to the question)\n- confidence (number)',
        );
    });

    it('parses a JSON object out of free-form model output', () => {
        const result = answer.parse(
            'Here you go: {"answer": "Paris", "confidence": 0.9} thanks!',
        );
        expect(result).toEqual({ answer: 'Paris', confidence: 0.9 });
    });

    it('throws when the output has no JSON object', () => {
        expect(() => answer.parse('no json here')).toThrow(
            'Expected a JSON object',
        );
    });

    it('throws when a required key is missing', () => {
        expect(() => answer.parse('{"answer": "Paris"}')).toThrow(
            'Missing key "confidence"',
        );
    });
});

describe('defineStructure with nested fields', () => {
    const order = defineStructure({
        customer: {
            type: 'object',
            description: 'who placed the order',
            properties: {
                name: { type: 'string' },
                vip: { type: 'boolean' },
            },
        },
        items: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    sku: { type: 'string' },
                    qty: { type: 'number' },
                },
            },
        },
    });

    it('describes nested object and array fields with indentation', () => {
        expect(order.describe()).toBe(
            [
                '- customer (object, who placed the order):',
                '  - name (string)',
                '  - vip (boolean)',
                '- items (array):',
                '  - item (object):',
                '    - sku (string)',
                '    - qty (number)',
            ].join('\n'),
        );
    });

    it('parses nested values through untouched', () => {
        const result = order.parse(
            JSON.stringify({
                customer: { name: 'Ada', vip: true },
                items: [{ sku: 'A1', qty: 2 }],
            }),
        );
        expect(result).toEqual({
            customer: { name: 'Ada', vip: true },
            items: [{ sku: 'A1', qty: 2 }],
        });
    });

    it('still only validates top-level required keys', () => {
        expect(() =>
            order.parse(JSON.stringify({ customer: { name: 'Ada' } })),
        ).toThrow('Missing key "items"');
    });
});
