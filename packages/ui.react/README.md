# @varlabs/ai.ui-react

React hooks binding for the AI SDK's headless chat core ([`@varlabs/ai.ui-core`](../ui.core)): `useChat`, file upload, and schema-driven forms.

## Installation
```bash
npm install @varlabs/ai.ui-react
# or
yarn add @varlabs/ai.ui-react
# or
pnpm add @varlabs/ai.ui-react
```

Requires `react` >= 18 as a peer dependency.

## Usage

### useChat

```tsx
import { useChat } from '@varlabs/ai.ui-react';

function Chat() {
  const { messages, status, input, handleInputChange, handleSubmit } = useChat({
    streamFn: (messages) => myProviderStream(messages),
  });

  return (
    <form onSubmit={handleSubmit}>
      {messages.map((m) => (
        <p key={m.id}>{m.role}: {m.content}</p>
      ))}
      <input value={input} onChange={handleInputChange} disabled={status === 'streaming'} />
    </form>
  );
}
```

### useFileUpload and useSchemaForm

`useFileUpload` manages attachment upload state against a [`@varlabs/ai.file-storage`](../file-storage) backend, and `useSchemaForm` derives controlled form fields from a JSON Schema object. See their exported types (`Attachment`, `JsonSchemaObject`) for the full shape.

## License
MIT
