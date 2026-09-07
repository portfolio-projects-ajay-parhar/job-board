import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider } from "./index";

/** AWS S3 — private bucket; downloads only via presigned GET URLs. */
export class S3Provider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const region = process.env.AWS_REGION;
    if (!region || !process.env.S3_BUCKET) {
      throw new Error("S3 storage requires AWS_REGION and S3_BUCKET");
    }
    this.client = new S3Client({ region });
    this.bucket = process.env.S3_BUCKET;
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Block any accidental public exposure — access only via signed URLs
        ServerSideEncryption: "AES256",
      }),
    );
  }

  async getDownloadUrl(key: string, ttlSeconds: number): Promise<string> {
    // S3 presigned URLs are capped at 7 days (604800s)
    const expiresIn = Math.min(Math.max(ttlSeconds, 1), 604_800);
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
