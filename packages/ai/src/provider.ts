
export type ProviderContext = {
    config: Record<string, any>; // for api keys, base urls, etc.
};

export type AIModelCallFn<Input, Output, Ctx extends ProviderContext> = (input: Input, ctx: Ctx) => Promise<Output>;

export type AIModel<Ctx extends ProviderContext> = Record<string, AIModelCallFn<any, any, Ctx>>;

export type Provider<Models extends Record<string, AIModel<Ctx>>, Ctx extends ProviderContext> = {
    name: string;
    models: Models;
    context: Ctx;
};

export const defineProvider = <Models extends Record<string, AIModel<Ctx>>, Ctx extends ProviderContext = ProviderContext>(
    provider: Provider<Models, Ctx>
) => {
    return (config: Ctx): Omit<Provider<Models, Ctx>, 'models'> & {
        models: {
            [ModelName in keyof Models]: {
                [CallName in keyof Models[ModelName]]: (
                    input: Parameters<Models[ModelName][CallName]>[0]
                ) => ReturnType<Models[ModelName][CallName]>;
            };
        };
    } => {
        // Wrap all calls to inject the context
        const wrapCalls = (calls: AIModel<Ctx>): Record<string, any> => {
            const wrappedCalls: Record<string, any> = {};
            for (const [key, callFn] of Object.entries(calls)) {
                wrappedCalls[key] = async (input: any) => {
                    return callFn(input, config); // Inject the context
                };
            }
            return wrappedCalls;
        };

        // Wrap all models
        const wrappedModels: Record<string, any> = {};
        for (const [modelName, model] of Object.entries(provider.models)) {
            wrappedModels[modelName] = wrapCalls(model);
        }

        // Return the provider with the injected context
        return {
            ...provider,
            models: wrappedModels as any,
        };
    };
};
