export type ProviderContext<
    Config extends Record<string, any> = Record<string, any>,
> = {
    config: Config; // overridable per-call: api keys, base urls, headers, timeouts, etc.
    internal?: Record<string, unknown>; // fixed at defineProvider time, never overridable per-call
};

export type ConfigOverride<Ctx extends ProviderContext> = {
    config?: Partial<Ctx['config']>;
};

export type AIModelCallFn<Input, Output, Ctx extends ProviderContext> = (
    input: Input,
    ctx: Ctx,
) => Promise<Output>;

export type AIModel<Ctx extends ProviderContext> = Record<
    string,
    AIModelCallFn<any, any, Ctx>
>;

export type Provider<
    Models extends Record<string, AIModel<Ctx>>,
    Ctx extends ProviderContext,
> = {
    name: string;
    models: Models;
    context: Ctx;
};

export const defineProvider = <
    Models extends Record<string, AIModel<Ctx>>,
    Ctx extends ProviderContext = ProviderContext,
>(
    provider: Provider<Models, Ctx>,
) => {
    return (
        ctx: Ctx,
    ): Omit<Provider<Models, Ctx>, 'models'> & {
        models: {
            [ModelName in keyof Models]: {
                [CallName in keyof Models[ModelName]]: (
                    input: Parameters<Models[ModelName][CallName]>[0],
                    override?: ConfigOverride<Ctx>,
                ) => ReturnType<Models[ModelName][CallName]>;
            };
        };
    } => {
        // Wrap all calls to inject the context, shallow-merging any per-call override onto it
        const wrapCalls = (calls: AIModel<Ctx>): Record<string, any> => {
            const wrappedCalls: Record<string, any> = {};
            for (const [key, callFn] of Object.entries(calls)) {
                wrappedCalls[key] = async (
                    input: any,
                    override?: ConfigOverride<Ctx>,
                ) => {
                    const callCtx = override?.config
                        ? {
                              ...ctx,
                              config: { ...ctx.config, ...override.config },
                          }
                        : ctx;
                    return callFn(input, callCtx);
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
