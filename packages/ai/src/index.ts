import type { defineProvider } from './provider.js';

type Middleware = <Input>(ctx: Input & {
    provider: string;
    model: string;
    call: string;
}) => boolean | Promise<boolean>;

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

    // Function to execute middleware chain
    const executeMiddleware = async <Input>(
        ctx: Input & { provider: string; model: string; call: string }
    ): Promise<boolean> => {
        for (const mw of middleware) {
            const result = await mw(ctx);
            if (!result) {
                return false; // Stop execution if middleware returns false
            }
        }
        return true; // Continue if all middleware return true
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
                (wrappedModel as any)[callKey] = async (input: any) => {
                    const ctx = { provider: key, model: modelKey, call: callKey, ...input };
                    const shouldContinue = await executeMiddleware(ctx);
                    if (!shouldContinue) {
                        throw new Error('Middleware stopped execution');
                    }
                    return callFn(input);
                };
            }

            (wrappedModels as any)[modelKey] = wrappedModel;
        }

        (client as any)[key] = wrappedModels;
    }

    return client;
};
