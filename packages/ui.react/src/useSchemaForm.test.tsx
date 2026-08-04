import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSchemaForm, type JsonSchemaObject } from './useSchemaForm.js';

const weatherSchema: JsonSchemaObject = {
    type: 'object',
    properties: {
        city: { type: 'string', required: true, description: 'City name' },
        units: { type: 'string', required: false },
    },
};

describe('useSchemaForm', () => {
    it('seeds default values from the schema', () => {
        const { result } = renderHook(() => useSchemaForm(weatherSchema));
        expect(result.current.values).toEqual({ city: '', units: '' });
    });

    it('seeds from initialValues when given (HITL edit-args flow)', () => {
        const { result } = renderHook(() => useSchemaForm(weatherSchema, { city: 'NYC' }));
        expect(result.current.values.city).toBe('NYC');
    });

    it('updates a field and reflects it in fields()', () => {
        const { result } = renderHook(() => useSchemaForm(weatherSchema));

        act(() => {
            result.current.setField('city', 'Boston');
        });

        expect(result.current.values.city).toBe('Boston');
        expect(result.current.fields.find((f) => f.key === 'city')?.value).toBe('Boston');
    });

    it('is invalid until required fields are filled', () => {
        const { result } = renderHook(() => useSchemaForm(weatherSchema));
        expect(result.current.isValid).toBe(false);

        act(() => {
            result.current.setField('city', 'Boston');
        });

        expect(result.current.isValid).toBe(true);
    });

    it('resets to defaults', () => {
        const { result } = renderHook(() => useSchemaForm(weatherSchema, { city: 'NYC' }));

        act(() => {
            result.current.setField('city', 'Boston');
        });
        act(() => {
            result.current.reset();
        });

        expect(result.current.values.city).toBe('NYC');
    });
});
