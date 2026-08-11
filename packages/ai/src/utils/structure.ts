export type StructureFieldSpec =
    | { type: 'string' | 'number' | 'boolean'; description?: string }
    | { type: 'object'; properties: StructureSpec; description?: string }
    | { type: 'array'; items: StructureFieldSpec; description?: string };

export type StructureSpec = Record<string, StructureFieldSpec>;

type InferField<F extends StructureFieldSpec> = F extends { type: 'string' }
    ? string
    : F extends { type: 'number' }
      ? number
      : F extends { type: 'boolean' }
        ? boolean
        : F extends { type: 'object'; properties: infer Properties }
          ? Properties extends StructureSpec
              ? InferStructure<Properties>
              : never
          : F extends { type: 'array'; items: infer Items }
            ? Items extends StructureFieldSpec
                ? InferField<Items>[]
                : never
            : never;

export type InferStructure<T extends StructureSpec> = {
    [K in keyof T]: InferField<T[K]>;
};

export type Structure<T extends StructureSpec> = {
    spec: T;
    // Human/model-readable description of the expected field shape, for embedding in a prompt.
    describe: () => string;
    // Extracts the first JSON object found in free-form model output and validates required keys.
    parse: (text: string) => InferStructure<T>;
};

const describeField = (
    key: string,
    field: StructureFieldSpec,
    indent: string,
): string => {
    const suffix = field.description ? `, ${field.description}` : '';
    const header = `${indent}- ${key} (${field.type}${suffix})`;

    if (field.type === 'object') {
        const nested = Object.entries(field.properties)
            .map(([k, f]) => describeField(k, f, `${indent}  `))
            .join('\n');
        return `${header}:\n${nested}`;
    }
    if (field.type === 'array') {
        return `${header}:\n${describeField('item', field.items, `${indent}  `)}`;
    }
    return header;
};

export const defineStructure = <T extends StructureSpec>(
    spec: T,
): Structure<T> => {
    const describe = (): string => {
        return Object.entries(spec)
            .map(([key, field]) => describeField(key, field, ''))
            .join('\n');
    };

    const parse = (text: string): InferStructure<T> => {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error(`Expected a JSON object but got: ${text}`);

        const parsed = JSON.parse(match[0]);
        for (const key of Object.keys(spec)) {
            if (!(key in parsed))
                throw new Error(
                    `Missing key "${key}" in structured output: ${text}`,
                );
        }
        return parsed as InferStructure<T>;
    };

    return { spec, describe, parse };
};
