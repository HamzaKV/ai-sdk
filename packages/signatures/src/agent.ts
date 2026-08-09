import type {
    StructureSpec,
    InferStructure,
} from '@varlabs/ai/utils/structure';
import type { Tool } from '@varlabs/ai/utils/tool';
import type { Signature } from './signature.js';

export type ReActAgentOptions<
    Input extends StructureSpec,
    Output extends StructureSpec,
> = {
    signature: Signature<Input, Output>;
    tools?: Record<string, Tool<any, any>>;
    // Plain text completion call, provider-agnostic - wrap whichever provider you use.
    callModel: (prompt: string) => Promise<string>;
    // Executes a client-located tool call; required if any registered tool has location: 'client'.
    onClientToolCall?: (name: string, args: unknown) => Promise<unknown>;
    maxSteps?: number;
};

type ToolCallInstruction = { tool: string; args: unknown };

const tryParseToolCall = (text: string): ToolCallInstruction | undefined => {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return undefined;

    try {
        const parsed = JSON.parse(match[0]);
        if (typeof parsed?.tool === 'string') {
            return { tool: parsed.tool, args: parsed.args };
        }
        return undefined;
    } catch {
        return undefined;
    }
};

const executeTool = async (
    tool: Tool<any, any>,
    args: unknown,
    onClientToolCall?: ReActAgentOptions<any, any>['onClientToolCall'],
): Promise<unknown> => {
    if (tool.location === 'server') {
        return tool.execute(args);
    }
    if (!onClientToolCall) {
        throw new Error(
            `Tool "${tool.name}" is client-located but no onClientToolCall handler was provided`,
        );
    }
    return onClientToolCall(tool.name, args);
};

// ReAct-style agent: one signature plus a tool set, looped until the model produces the
// signature's final output (or maxSteps is exceeded). Server tools run inline; client
// tools are handed to onClientToolCall, the same execution split used by the SDK's providers.
export const runReActAgent = async <
    Input extends StructureSpec,
    Output extends StructureSpec,
>(
    options: ReActAgentOptions<Input, Output>,
    input: InferStructure<Input>,
): Promise<InferStructure<Output>> => {
    const maxSteps = options.maxSteps ?? 5;
    const tools = options.tools ?? {};
    const toolDescriptions =
        Object.entries(tools)
            .map(([name, tool]) => `- ${name}: ${tool.description}`)
            .join('\n') || '(no tools available)';

    const scratchpad: string[] = [];

    for (let step = 0; step < maxSteps; step++) {
        const prompt = [
            options.signature.compilePrompt(input),
            '',
            'You may call one of the following tools if needed:',
            toolDescriptions,
            '',
            'To call a tool, respond with ONLY a JSON object: {"tool": "<name>", "args": {...}}.',
            'When you have the final answer, respond with ONLY the JSON object matching the required output fields.',
            ...scratchpad,
        ].join('\n');

        const response = await options.callModel(prompt);
        const toolCall = tryParseToolCall(response);

        if (!toolCall) {
            return options.signature.parseOutput(response);
        }

        const tool = tools[toolCall.tool];
        if (!tool) {
            scratchpad.push(
                `Tool "${toolCall.tool}" does not exist. Available tools: ${Object.keys(tools).join(', ')}`,
            );
            continue;
        }

        const result = await executeTool(
            tool,
            toolCall.args,
            options.onClientToolCall,
        );
        scratchpad.push(
            `Called ${toolCall.tool}(${JSON.stringify(toolCall.args)}) -> ${JSON.stringify(result)}`,
        );
    }

    throw new Error(
        `ReAct agent exceeded maxSteps (${maxSteps}) without producing a final answer`,
    );
};
