# @varlabs/ai.openai

A comprehensive, type-safe OpenAI provider for the @varlabs/ai SDK.

## Features

- **Complete API Coverage** - Support for all OpenAI API endpoints including:
  - Text generation (ChatGPT, GPT-4, etc.)
  - Image generation (DALL-E models)
  - Audio processing (speech synthesis and transcription)
  - Embeddings
  - Function calling
  - Structured output

- **Type Safety** - Fully typed interfaces for all API endpoints and models with proper type inference.

- **Streaming Support** - First-class support for streaming responses from OpenAI.

- **Custom Tools Integration** - Easy integration with custom tools and function calling.

- **Advanced Features** - Support for file search, web search, reasoning, and more.

## Installation

```bash
npm install @varlabs/ai.openai

# or

yarn add @varlabs/ai.openai

# or

pnpm add @varlabs/ai.openai
```

## Usage

### Basic Usage

```typescript
import { createAIClient } from '@varlabs/ai';
import openAiProvider from '@varlabs/ai.openai';

const client = createAIClient({
  providers: {
    openai: openAiProvider({
      config: {
        apiKey: 'your-api-key',
        baseUrl: 'https://api.openai.com/v1' // optional, defaults to this value
      }
    })
  }
});

// Text generation
const response = await client.openai.text.create_response({
  model: 'gpt-4o',
  input: 'Tell me a joke about programming.'
});

// Image generation
const image = await client.openai.images.create({
  model: 'dall-e-3',
  prompt: 'A robot writing code in a futuristic office'
});

// Audio transcription
const transcription = await client.openai.speech.transcribe_audio({
  model: 'whisper-1',
  file: audioFile
});
```

### Streaming Responses

```typescript
const stream = await client.openai.text.create_response({
  model: 'gpt-4o',
  input: 'Write a short story about AI.',
  stream: true
});

// Handle the stream
for await (const chunk of stream) {
  // Process each chunk of the response
  console.log(chunk);
}
```

### Using Custom Tools

```typescript
const response = await client.openai.text.create_response({
  model: 'gpt-4o',
  input: 'What\'s the weather in New York?',
  custom_tools: {
    get_weather: customTool({
      description: 'Get current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' }
        },
        required: ['location']
      },
      execute: async (params) => {
        // Implementation to fetch weather data
        return { temperature: 72, conditions: 'sunny' };
      }
    })
  }
});
```

### Structured Output

```typescript
const response = await client.openai.text.create_response({
  model: 'gpt-4o',
  input: 'Extract the name and age from: John Doe is 30 years old',
  structured_output: {
    name: 'PersonInfo',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Full name of the person' },
        age: { type: 'number', description: 'Age in years' }
      },
      required: true
    }
  }
});
```

## API Reference

The provider implements all OpenAI API endpoints through the following structure:

- `text` - Text generation and chat models
  - `create_response` - Generate text responses
  - `get_response` - Get a previously generated response
  - `delete_response` - Delete a response
  - `list_input_item_list` - List items for a response

- `images` - Image generation models
  - `create` - Create images
  - `edit` - Edit existing images
  - `generate_variations` - Create variations of images

- `speech` - Audio processing models
  - `generate_audio` - Generate speech from text
  - `transcribe_audio` - Transcribe audio to text
  - `translate_audio` - Translate audio to English text

- `embedding` - Embedding models
  - `embed` - Create embeddings for text

## License

MIT © Hamza Varvani
