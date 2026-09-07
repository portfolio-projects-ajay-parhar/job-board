import { v2 as cloudinary } from "cloudinary";
import type { StorageProvider } from "./index";

/**
 * Cloudinary — raw/authenticated assets. Objects are never publicly
 * accessible; downloads use signed delivery URLs with an expiry token.
 */
export class CloudinaryProvider implements StorageProvider {
  constructor() {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new Error("Cloudinary storage requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET");
    }
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
      secure: true,
    });
  }

  async upload(key: string, body: Buffer, _contentType: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: "raw", type: "authenticated", public_id: key, overwrite: true },
        (error) => (error ? reject(error) : resolve()),
      );
      stream.end(body);
    });
  }

  async getDownloadUrl(key: string, ttlSeconds: number): Promise<string> {
    return cloudinary.url(key, {
      resource_type: "raw",
      type: "authenticated",
      sign_url: true,
      auth_token: { duration: ttlSeconds },
    });
  }

  async delete(key: string): Promise<void> {
    await cloudinary.uploader.destroy(key, { resource_type: "raw", type: "authenticated" });
  }
}
