// A minimal JSON-Schema-shaped parameter description, plus a type-level
// inference from it to the TS type it describes. Shared by provider packages'
// bespoke CustomTool types (each provider keeps its own tool wire shape -
// see the ai-sdk gap-scan notes on why - but this schema/inference layer is
// pure and identical across them, so it lives here instead of being
// copy-pasted per provider).
export type JsonSchemaParameterBase = {
    type: 'string' | 'number' | 'boolean';
    description?: string;
    required?: boolean;
};

export type JsonSchemaParameterArray = {
    type: 'array';
    items: (
        | JsonSchemaParameterBase
        | JsonSchemaParameterObject
        | JsonSchemaParameterArray
    )[];
    description?: string;
    required?: boolean;
};

export type JsonSchemaParameterObject = {
    type: 'object';
    properties: Record<
        string,
        | JsonSchemaParameterObject
        | JsonSchemaParameterBase
        | JsonSchemaParameterArray
    >;
    description?: string;
    required?: boolean;
};

export type JsonSchemaParameters = {
    type: 'object';
    properties: Record<
        string,
        | JsonSchemaParameterObject
        | JsonSchemaParameterBase
        | JsonSchemaParameterArray
    >;
    additionalProperties?: boolean;
};

export type InferJsonSchemaParameter<T> = T extends { type: 'string' }
    ? string
    : T extends { type: 'number' }
      ? number
      : T extends { type: 'boolean' }
        ? boolean
        : T extends { type: 'array'; items: infer Items }
          ? InferJsonSchemaArray<Items>
          : T extends { type: 'object'; properties: infer Properties }
            ? Properties extends Record<string, any>
                ? InferJsonSchemaObject<Properties>
                : never
            : never;

export type InferJsonSchemaArray<T> = T extends (infer U)[]
    ? InferJsonSchemaParameter<U>[]
    : never;

export type InferJsonSchemaObject<T extends Record<string, any>> = {
    [K in keyof T as T[K]['required'] extends true
        ? K
        : never]: InferJsonSchemaParameter<T[K]>;
} & {
    [K in keyof T as T[K]['required'] extends true
        ? never
        : K]?: InferJsonSchemaParameter<T[K]>;
};

export type InferJsonSchemaParameters<T extends JsonSchemaParameters> =
    T extends { properties: infer Props }
        ? Props extends Record<string, any>
            ? InferJsonSchemaObject<Props>
            : never
        : never;
