/**
 * Pluggable document storage.
 *
 * `STORAGE_PROVIDER` selects the backend — no call-site changes:
 *   s3         → private bucket + presigned GET URLs
 *   cloudinary → raw/authenticated assets + signed delivery URLs
 *   local      → dev/test disk fallback under `.uploads/` (dev parity with
 *                the signed-URL flow via HMAC-signed internal links)
 */

export interface StorageProvider {
  upload(key: string, body: Buffer, contentType: string): Promise<void>;
  getDownloadUrl(key: string, ttlSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}

import { LocalProvider } from "./local";
import { S3Provider } from "./s3";
import { CloudinaryProvider } from "./cloudinary";

export function getStorage(): StorageProvider {
  switch (process.env.STORAGE_PROVIDER) {
    case "s3":
      return new S3Provider();
    case "cloudinary":
      return new CloudinaryProvider();
    default:
      return new LocalProvider();
  }
}
