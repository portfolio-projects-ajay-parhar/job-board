import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { verifyLocalSignature } from "@/lib/storage/local";

const ROOT = path.join(process.cwd(), ".uploads");

/**
 * GET /api/storage/local — streams local-provider objects after verifying
 * the HMAC-signed link (expiry enforced). Dev parity with presigned S3 /
 * signed Cloudinary URLs: callers must still be authorized upstream — the
 * link itself is the capability.
 */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const expires = req.nextUrl.searchParams.get("expires");
  const sig = req.nextUrl.searchParams.get("sig");

  if (!key || key.includes("..") || path.isAbsolute(key)) {
    return new Response("Bad request", { status: 400 });
  }
  if (!verifyLocalSignature(key, expires, sig)) {
    return new Response("Forbidden — invalid or expired link", { status: 403 });
  }

  try {
    const body = readFileSync(path.join(ROOT, key));
    return new Response(new Uint8Array(body), {
      headers: { "Content-Type": "application/octet-stream" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
