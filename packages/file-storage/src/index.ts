export type FileMeta = {
    name: string;
    type: string;
    size: number;
};

// Upload-then-reference: the SDK never carries file bytes through chat requests -
// callers upload directly to the backend this adapter fronts, then pass the fileId around.
export type FileStorage = {
    getUploadUrl(
        meta: FileMeta,
    ): Promise<{ uploadUrl: string; fileId: string }>;
    getDownloadUrl(fileId: string): Promise<string>;
    delete(fileId: string): Promise<void>;
};

// Reference implementation for dev/tests: "uploads" are stored in memory and served back
// as data: URIs. Not for production use - swap in a real backend (S3, GCS, etc) there.
export const createInMemoryFileStorage = (): FileStorage & {
    // Test/dev-only escape hatch: write bytes directly, bypassing the upload URL round-trip.
    put(fileId: string, meta: FileMeta, data: Uint8Array): void;
} => {
    const files = new Map<string, { meta: FileMeta; data: Uint8Array }>();

    return {
        async getUploadUrl(meta) {
            const fileId = crypto.randomUUID();
            files.set(fileId, { meta, data: new Uint8Array() });
            return { uploadUrl: `memory://${fileId}`, fileId };
        },
        async getDownloadUrl(fileId) {
            const file = files.get(fileId);
            if (!file) throw new Error(`Unknown fileId: ${fileId}`);

            const base64 = btoa(String.fromCharCode(...file.data));
            return `data:${file.meta.type};base64,${base64}`;
        },
        async delete(fileId) {
            files.delete(fileId);
        },
        put(fileId, meta, data) {
            files.set(fileId, { meta, data });
        },
    };
};
