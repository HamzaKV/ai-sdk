import {
    defineStructure,
    type StructureSpec,
    type InferStructure,
} from '@varlabs/ai/utils/structure';

export type SignatureSpec<
    Input extends StructureSpec,
    Output extends StructureSpec,
> = {
    input: Input;
    output: Output;
    instructions?: string;
};

export type Signature<
    Input extends StructureSpec,
    Output extends StructureSpec,
> = {
    spec: SignatureSpec<Input, Output>;
    // Compiles the signature + a concrete input into the prompt to send to the model.
    compilePrompt: (input: InferStructure<Input>) => string;
    // Parses the model's response back into the signature's typed output.
    parseOutput: (text: string) => InferStructure<Output>;
};

// DSPy/ax-style signature: a typed input/output spec that compiles into a prompt and
// parses the model's response back into the declared shape - no hand-written prompt strings.
export const defineSignature = <
    Input extends StructureSpec,
    Output extends StructureSpec,
>(
    spec: SignatureSpec<Input, Output>,
): Signature<Input, Output> => {
    const outputStructure = defineStructure(spec.output);

    const compilePrompt = (input: InferStructure<Input>): string => {
        const lines: string[] = [];
        if (spec.instructions) lines.push(spec.instructions, '');

        lines.push('Inputs:');
        for (const key of Object.keys(spec.input)) {
            lines.push(
                `${key}: ${JSON.stringify((input as Record<string, unknown>)[key])}`,
            );
        }

        lines.push(
            '',
            'Produce a single JSON object with exactly these fields:',
            outputStructure.describe(),
            '',
            'Respond with ONLY the JSON object, no other text.',
        );

        return lines.join('\n');
    };

    return { spec, compilePrompt, parseOutput: outputStructure.parse };
};
