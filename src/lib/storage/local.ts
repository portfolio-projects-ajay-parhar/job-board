import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { StorageProvider } from "./index";

const ROOT = path.join(process.cwd(), ".uploads");

/** Reject traversal / absolute keys — keys are always server-generated, but stay defensive. */
export function assertSafeKey(key: string): void {
  if (!key || key.includes("..") || path.isAbsolute(key) || key.startsWith("/")) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
}

function sign(key: string, expires: number): string {
  return createHmac("sha256", process.env.NEXTAUTH_SECRET ?? "dev-secret")
    .update(`${key}:${expires}`)
    .digest("hex");
}

/**
 * Local disk provider. `getDownloadUrl` returns an HMAC-signed internal link
 * (expiry enforced) so dev has the same "short-lived URL" semantics as S3.
 */
export class LocalProvider implements StorageProvider {
  async upload(key: string, body: Buffer, _contentType: string): Promise<void> {
    assertSafeKey(key);
    const target = path.join(ROOT, key);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, body);
  }

  async getDownloadUrl(key: string, ttlSeconds: number): Promise<string> {
    assertSafeKey(key);
    const expires = Date.now() + ttlSeconds * 1000;
    const sig = sign(key, expires);
    return `/api/storage/local?key=${encodeURIComponent(key)}&expires=${expires}&sig=${sig}`;
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    try {
      unlinkSync(path.join(ROOT, key));
    } catch {
      // deleting a missing object is a no-op (S3 semantics)
    }
  }
}

/** Verifies an HMAC-signed local download link (used by the streaming route). */
export function verifyLocalSignature(key: string, expires: string | null, sig: string | null): boolean {
  if (!key || !expires || !sig) return false;
  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
  const expected = sign(key, expiresAt);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
