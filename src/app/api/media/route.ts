import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/storage";
import { validateImageUpload } from "@/lib/upload-validation";
import { requireUser } from "@/lib/auth-guards";
import { ApiError, handleApiError } from "@/lib/errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/media — signed-in image uploads (company logos).
 * MIME + magic-byte allowlist, 2 MB hard limit, server-generated key.
 * The returned URL is a short-lived signed link; logos are re-resolved from
 * the stored key when needed, so an expiring URL never breaks rendering
 * (see Company.logoUrl → key convention below).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const rl = rateLimit(`media:${clientIp(req)}`, 20, 60_000);
    if (!rl.ok) throw new ApiError(429, "Too many uploads — try again shortly", "RATE_LIMITED");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "Missing file field");

    const buffer = Buffer.from(await file.arrayBuffer());
    const { ext } = validateImageUpload(buffer, file.type, file.name);

    const key = `media/${user.id}/${randomUUID()}.${ext}`;
    await getStorage().upload(key, buffer, file.type);
    const url = await getStorage().getDownloadUrl(key, 7 * 24 * 60 * 60); // 7 days

    return NextResponse.json({ key, url, fileName: file.name, sizeBytes: buffer.length }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
