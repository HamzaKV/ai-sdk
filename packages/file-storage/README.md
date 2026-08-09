# @varlabs/ai.file-storage

Bring-your-own-backend file storage adapter for the AI SDK's upload-then-reference attachment flow: the SDK never carries file bytes through chat requests - callers upload directly to the backend this adapter fronts, then pass the `fileId` around.

## Installation
```bash
npm install @varlabs/ai.file-storage
# or
yarn add @varlabs/ai.file-storage
# or
pnpm add @varlabs/ai.file-storage
```

## Usage

Implement the `FileStorage` interface against your own backend (S3, GCS, etc.), or use `createInMemoryFileStorage` for dev/tests:

```typescript
import { createInMemoryFileStorage } from '@varlabs/ai.file-storage';

const storage = createInMemoryFileStorage();

const { uploadUrl, fileId } = await storage.getUploadUrl({
  name: 'photo.png',
  type: 'image/png',
  size: 1024,
});

const downloadUrl = await storage.getDownloadUrl(fileId);

await storage.delete(fileId);
```

`createInMemoryFileStorage` is a reference implementation only - it stores uploads in memory and serves them back as `data:` URIs. Swap in a real backend for production by implementing `FileStorage` yourself.

## License
MIT
