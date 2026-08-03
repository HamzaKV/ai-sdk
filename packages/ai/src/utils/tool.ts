export type ToolBase<Input> = {
    name: string;
    description: string;
    parameters: Input;
};

export type ToolExecuteFn<Input, Output> = (input: Input) => Promise<Output>;

// Runs on the server: the SDK invokes execute() itself when the model calls this tool.
export type ServerTool<Input, Output> = ToolBase<Input> & {
    location: 'server';
    execute: ToolExecuteFn<Input, Output>;
};

// Runs on the client: the SDK pauses and hands the call to the caller to execute.
export type ClientTool<Input> = ToolBase<Input> & {
    location: 'client';
};

export type Tool<Input, Output = unknown> = ServerTool<Input, Output> | ClientTool<Input>;

export const defineTool = <T extends Tool<any, any>>(tool: T): T => {
    return tool;
};
