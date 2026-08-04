export type StructureFieldSpec = {
    type: 'string' | 'number' | 'boolean';
    description?: string;
};

export type StructureSpec = Record<string, StructureFieldSpec>;

type InferField<F extends StructureFieldSpec> =
    F['type'] extends 'string' ? string :
    F['type'] extends 'number' ? number :
    F['type'] extends 'boolean' ? boolean :
    never;

export type InferStructure<T extends StructureSpec> = { [K in keyof T]: InferField<T[K]> };

export type Structure<T extends StructureSpec> = {
    spec: T;
    // Human/model-readable description of the expected field shape, for embedding in a prompt.
    describe: () => string;
    // Extracts the first JSON object found in free-form model output and validates required keys.
    parse: (text: string) => InferStructure<T>;
};

export const defineStructure = <T extends StructureSpec>(spec: T): Structure<T> => {
    const describe = (): string => {
        return Object.entries(spec)
            .map(([key, field]) => `- ${key} (${field.type}${field.description ? `, ${field.description}` : ''})`)
            .join('\n');
    };

    const parse = (text: string): InferStructure<T> => {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error(`Expected a JSON object but got: ${text}`);

        const parsed = JSON.parse(match[0]);
        for (const key of Object.keys(spec)) {
            if (!(key in parsed)) throw new Error(`Missing key "${key}" in structured output: ${text}`);
        }
        return parsed as InferStructure<T>;
    };

    return { spec, describe, parse };
};
