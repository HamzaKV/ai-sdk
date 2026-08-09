import { useState, useCallback } from 'react';
import type { FileStorage } from '@varlabs/ai.file-storage';

export type Attachment = {
    fileId: string;
    name: string;
    type: string;
    size: number;
};

// Manages the upload-then-reference flow for chat attachments: files are uploaded to the
// app-provided FileStorage backend as soon as they're added, and the message only ever
// carries the resulting fileId reference - never inline bytes.
export const useFileUpload = (fileStorage: FileStorage) => {
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [uploading, setUploading] = useState(false);

    const addFile = useCallback(
        async (
            file: { name: string; type: string; size: number },
            data: Uint8Array,
        ) => {
            setUploading(true);
            try {
                const { uploadUrl, fileId } = await fileStorage.getUploadUrl({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                });
                await fetch(uploadUrl, {
                    method: 'PUT',
                    body: data,
                    headers: { 'Content-Type': file.type },
                });
                const attachment: Attachment = {
                    fileId,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                };
                setAttachments((prev) => [...prev, attachment]);
                return attachment;
            } finally {
                setUploading(false);
            }
        },
        [fileStorage],
    );

    const removeFile = useCallback(
        (fileId: string) => {
            setAttachments((prev) => prev.filter((a) => a.fileId !== fileId));
            void fileStorage.delete(fileId);
        },
        [fileStorage],
    );

    const clear = useCallback(() => {
        setAttachments([]);
    }, []);

    return { attachments, uploading, addFile, removeFile, clear };
};
