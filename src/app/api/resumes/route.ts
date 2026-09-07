import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCandidate } from "@/lib/auth-guards";
import { ApiError, handleApiError } from "@/lib/errors";
import { getStorage } from "@/lib/storage";
import { validateResumeUpload, sanitizeFileName, buildResumeKey } from "@/lib/upload-validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const MAX_RESUMES = 5;

/** GET /api/resumes — the candidate's own resumes with application counts. */
export async function GET() {
  try {
    const { user } = await requireCandidate();
    const resumes = await prisma.resume.findMany({
      where: { candidateId: user.id },
      orderBy: { uploadedAt: "desc" },
      include: { _count: { select: { applications: true } } },
    });
    return NextResponse.json({
      items: resumes.map(({ _count, ...r }) => ({ ...r, appliedCount: _count.applications })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * POST /api/resumes — multipart resume upload.
 * Pipeline: MIME allowlist (415) → 5 MB limit (413) → magic bytes (415)
 * → server-generated key (client filename never in the key)
 * → storage.upload → Resume row (+ primary handling) in one transaction.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireCandidate();
    const rl = rateLimit(`resumes:${user.id}`, 10, 60_000);
    if (!rl.ok) throw new ApiError(429, "Too many uploads — try again shortly", "RATE_LIMITED");

    const form = await req.formData();
    const file = form.get("file");
    const makePrimary = form.get("makePrimary") === "true";
    if (!(file instanceof File)) throw new ApiError(400, "Missing file field");

    const buffer = Buffer.from(await file.arrayBuffer());
    const { ext } = validateResumeUpload(buffer, file.type, file.name);

    const existing = await prisma.resume.count({ where: { candidateId: user.id } });
    if (existing >= MAX_RESUMES) {
      throw new ApiError(409, `Resume limit reached (${MAX_RESUMES}) — delete one first`, "RESUME_LIMIT");
    }

    const key = buildResumeKey(user.id, ext);
    const provider = (process.env.STORAGE_PROVIDER?.toUpperCase() || "LOCAL") as "S3" | "CLOUDINARY" | "LOCAL";
    await getStorage().upload(key, buffer, file.type);

    const resume = await prisma.$transaction(async (tx) => {
      const hasPrimary = await tx.resume.findFirst({ where: { candidateId: user.id, isPrimary: true } });
      const isPrimary = makePrimary || !hasPrimary;
      if (isPrimary && hasPrimary) {
        await tx.resume.update({ where: { id: hasPrimary.id }, data: { isPrimary: false } });
      }
      return tx.resume.create({
        data: {
          candidateId: user.id,
          storageKey: key,
          provider,
          fileName: sanitizeFileName(file.name),
          mimeType: ext === "pdf" ? "PDF" : "DOCX",
          sizeBytes: buffer.length,
          isPrimary,
        },
      });
    });

    return NextResponse.json(resume, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
