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

No first-party production adapter ships here on purpose - a real backend (S3, GCS, local disk, ...) is a per-app choice, and forcing e.g. the AWS SDK on everyone who installs this package would contradict the bring-your-own-backend design. A starting point against S3 (untested, adapt to your setup) using `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`:

```typescript
import { S3Client, GetObjectCommand, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { FileStorage } from '@varlabs/ai.file-storage';

const createS3FileStorage = (client: S3Client, bucket: string): FileStorage => ({
  async getUploadUrl(meta) {
    const fileId = crypto.randomUUID();
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: bucket, Key: fileId, ContentType: meta.type }),
    );
    return { uploadUrl, fileId };
  },
  async getDownloadUrl(fileId) {
    return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: fileId }));
  },
  async delete(fileId) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: fileId }));
  },
});
```

## License
MIT
