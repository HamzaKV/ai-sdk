export type ToolExecuteFn<Input, Output> = (input: Input) => Promise<Output>;

export type Tool<Input, Output> = {
    name: string;
    description: string;
    parameters: Input;
    execute: ToolExecuteFn<Input, Output>;
};

export const defineTool = <Input, Output>(
    tool: Tool<Input, Output>
) => {
    return tool;
};
