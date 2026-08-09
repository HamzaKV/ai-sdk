import { describe, it, expect } from 'vitest';
import { createInMemoryFileStorage } from './index';

describe('createInMemoryFileStorage', () => {
    it('issues an upload url and fileId for new files', async () => {
        const storage = createInMemoryFileStorage();

        const { uploadUrl, fileId } = await storage.getUploadUrl({
            name: 'photo.png',
            type: 'image/png',
            size: 1024,
        });

        expect(uploadUrl).toContain(fileId);
    });

    it('serves uploaded bytes back as a data url', async () => {
        const storage = createInMemoryFileStorage();
        const { fileId } = await storage.getUploadUrl({
            name: 'a.txt',
            type: 'text/plain',
            size: 5,
        });

        storage.put(
            fileId,
            { name: 'a.txt', type: 'text/plain', size: 5 },
            new TextEncoder().encode('hello'),
        );

        const downloadUrl = await storage.getDownloadUrl(fileId);
        expect(downloadUrl).toBe(`data:text/plain;base64,${btoa('hello')}`);
    });

    it('throws when downloading an unknown fileId', async () => {
        const storage = createInMemoryFileStorage();
        await expect(storage.getDownloadUrl('missing')).rejects.toThrow(
            'Unknown fileId',
        );
    });

    it('deletes files', async () => {
        const storage = createInMemoryFileStorage();
        const { fileId } = await storage.getUploadUrl({
            name: 'a.txt',
            type: 'text/plain',
            size: 5,
        });

        await storage.delete(fileId);

        await expect(storage.getDownloadUrl(fileId)).rejects.toThrow(
            'Unknown fileId',
        );
    });
});
