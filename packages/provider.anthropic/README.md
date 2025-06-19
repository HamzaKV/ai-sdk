# @varlabs/ai.anthropic

A comprehensive, type-safe Anthropic AI provider for the @varlabs/ai SDK.

## Features

- **Complete API Coverage** - Support for all Anthropic Claude API endpoints:
  - Chat completions with all Claude models
  - Streaming responses
  - Custom tools integration
  - System prompts
  - Multi-modal inputs (text, images, documents)
  - Built-in tools (code execution, web search, bash, etc.)

- **Type Safety** - Fully typed interfaces for all API endpoints and models with proper type inference.

- **Streaming Support** - First-class support for streaming responses from Anthropic.

- **Custom Tools Integration** - Easy integration with custom tools and function calling.

- **Advanced Features** - Support for thinking steps, citations, cache control, and more.

## Installation

```bash
npm install @varlabs/ai.anthropic

# or

yarn add @varlabs/ai.anthropic

# or

pnpm add @varlabs/ai.anthropic
```

## Usage

### Basic Usage

```typescript
import { createAIClient } from '@varlabs/ai';
import anthropicProvider from '@varlabs/ai.anthropic';

const client = createAIClient({
  providers: {
    anthropic: anthropicProvider({
      config: {
        apiKey: 'your-api-key',
        baseUrl: 'https://api.anthropic.com/v1', // optional, defaults to this value
        apiVersion: '2023-06-01' // optional, defaults to this value
      }
    })
  }
});

// Text generation
const response = await client.anthropic.claude.messages({
  model: 'claude-3-opus-20240229',
  messages: [
    { role: 'user', content: 'Tell me a joke about programming.' }
  ],
  max_tokens: 1000
});
```

### Streaming Responses

```typescript
const stream = await client.anthropic.claude.stream({
  model: 'claude-3-sonnet-20240229',
  messages: [
    { role: 'user', content: 'Write a short story about AI.' }
  ],
  max_tokens: 1000
});

// Handle the stream
for await (const chunk of stream) {
  // Process each chunk of the response
  console.log(chunk);
}
```

### Using Custom Tools

```typescript
import { customTool } from '@varlabs/ai.anthropic';

const response = await client.anthropic.claude.messages({
  model: 'claude-3-opus-20240229',
  messages: [
    { role: 'user', content: 'What\'s the weather in New York?' }
  ],
  max_tokens: 1000,
  tools: [
    customTool({
      name: 'get_weather',
      type: 'custom',
      description: 'Get current weather for a location',
      input_schema: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name', required: true }
        }
      },
      execute: async (params) => {
        // Implementation to fetch weather data
        return { temperature: 72, conditions: 'sunny' };
      }
    })
  ]
});
```

### Multi-modal Messages

```typescript
const response = await client.anthropic.claude.messages({
  model: 'claude-3-opus-20240229',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'What's in this image?'
        },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: 'base64EncodedImageData'
          }
        }
      ]
    }
  ],
  max_tokens: 1000
});
```

### Using Built-in Tools

```typescript
const response = await client.anthropic.claude.messages({
  model: 'claude-3-opus-20240229',
  messages: [
    { role: 'user', content: 'Search for recent news about AI.' }
  ],
  max_tokens: 1000,
  tools: [
    {
      name: 'web_search',
      type: 'web_search_20250305',
      max_uses: 3
    }
  ]
});
```

## Supported Models

The provider supports all Claude models including:

- Claude 4 models (`claude-opus-4-20250514`, `claude-sonnet-4-20250514`)
- Claude 3.7 models (`claude-3-7-sonnet-20250219`)
- Claude 3.5 models (`claude-3-5-haiku-20241022`, `claude-3-5-sonnet-20241022`)
- Claude 3 models (`claude-3-opus-20240229`, `claude-3-sonnet-20240229`, `claude-3-haiku-20240307`)

## API Reference

The provider implements the Anthropic API endpoints through the following structure:

- `claude` - Claude models
  - `messages` - Generate responses with Claude
  - `stream` - Stream responses from Claude

### Built-in Tools

The following built-in tools are supported:

- `bash` - Execute bash commands
- `code_execution` - Execute code in various languages
- `computer` - Operate a virtual computer interface
- `text_editor` - Edit text using string replace operations
- `web_search` - Search the web for information

## License

MIT © Hamza Varvani
