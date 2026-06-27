export interface StorageProvider {
  upload(
    bucket: string,
    path: string,
    blob: Blob,
    contentType: string,
  ): Promise<{ path: string }>;
  signedUrl(bucket: string, path: string, expiresSeconds?: number): Promise<string>;
  remove(bucket: string, paths: string[]): Promise<void>;
}
