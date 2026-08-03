import type { defineProvider } from './provider.js';

export type MiddlewareContext<Input = any> = {
    provider: string;
    model: string;
    call: string;
    input: Input;
};

export type Middleware = <Input>(
    ctx: MiddlewareContext<Input>
) => MiddlewareContext<Input> | false | Promise<MiddlewareContext<Input> | false>;

type ProviderInstance = ReturnType<ReturnType<typeof defineProvider>>;

type ProviderMap = Record<string, ProviderInstance>;

interface CreateAIClientOptions<TProviders extends ProviderMap> {
    providers: TProviders;
    middleware?: Middleware[];
}

type AIClient<TProviders extends ProviderMap> = {
    [K in keyof TProviders]: TProviders[K]['models'];
};

export const createAIClient = <TProviders extends ProviderMap>(
    options: CreateAIClientOptions<TProviders>
) => {
    const { providers, middleware = [] } = options;

    // Initialize the client object
    const client = {} as AIClient<TProviders>;

    // Run the middleware chain, threading the (possibly transformed) ctx through each step
    const executeMiddleware = async <Input>(
        initialCtx: MiddlewareContext<Input>
    ): Promise<MiddlewareContext<Input> | false> => {
        let ctx = initialCtx;
        for (const mw of middleware) {
            const result = await mw(ctx);
            if (result === false) {
                return false; // Stop execution if middleware returns false
            }
            ctx = result;
        }
        return ctx;
    };

    for (const key of Object.keys(providers) as Array<keyof TProviders>) {
        const provider = providers[key];

        // Wrap each model's methods with middleware
        const wrappedModels = {} as TProviders[keyof TProviders]['models'];
        for (const modelKey of Object.keys(provider.models)) {
            const model = provider.models[modelKey];

            // Wrap each call in the model
            const wrappedModel = {} as TProviders[keyof TProviders]['models'][string];
            for (const callKey of Object.keys(model)) {
                const callFn = model[callKey];

                // Wrap the call function
                (wrappedModel as any)[callKey] = async (input: any, override?: any) => {
                    const ctx = await executeMiddleware({ provider: key as string, model: modelKey, call: callKey, input });
                    if (!ctx) {
                        throw new Error('Middleware stopped execution');
                    }
                    return callFn(ctx.input, override);
                };
            }

            (wrappedModels as any)[modelKey] = wrappedModel;
        }

        (client as any)[key] = wrappedModels;
    }

    return client;
};
