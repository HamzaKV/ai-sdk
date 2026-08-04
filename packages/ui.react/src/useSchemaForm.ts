import { useState, useCallback, useMemo } from 'react';

export type JsonSchemaProperty = {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description?: string;
    required?: boolean;
};

export type JsonSchemaObject = {
    type: 'object';
    properties: Record<string, JsonSchemaProperty>;
};

export type SchemaField = JsonSchemaProperty & {
    key: string;
    value: unknown;
};

const defaultsFromSchema = (schema: JsonSchemaObject): Record<string, unknown> => {
    const defaults: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(schema.properties)) {
        defaults[key] = prop.type === 'boolean' ? false : prop.type === 'number' ? undefined : '';
    }
    return defaults;
};

// Renders a form from a tool's JSON-schema parameters - used for the HITL "edit args
// before approving" flow, or any tool that needs structured user input mid-conversation.
export const useSchemaForm = (schema: JsonSchemaObject, initialValues?: Record<string, unknown>) => {
    const [values, setValues] = useState<Record<string, unknown>>(
        () => ({ ...defaultsFromSchema(schema), ...initialValues })
    );

    const setField = useCallback((key: string, value: unknown) => {
        setValues((prev) => ({ ...prev, [key]: value }));
    }, []);

    const reset = useCallback(() => {
        setValues({ ...defaultsFromSchema(schema), ...initialValues });
        // biome-ignore lint/correctness/useExhaustiveDependencies: schema/initialValues intentionally re-read fresh on reset only
    }, [schema, initialValues]);

    const fields: SchemaField[] = useMemo(
        () => Object.entries(schema.properties).map(([key, prop]) => ({ ...prop, key, value: values[key] })),
        [schema, values]
    );

    const isValid = useMemo(
        () => fields.every((f) => !f.required || (f.value !== undefined && f.value !== '')),
        [fields]
    );

    return { values, fields, setField, isValid, reset };
};
