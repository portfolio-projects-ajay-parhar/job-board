import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guards";
import { ApiError, handleApiError } from "@/lib/errors";
import { getStorage } from "@/lib/storage";

/**
 * GET /api/resumes/[id]/download — authorization matrix:
 *   candidate owner ✓ · employer of an applied job ✓ · ADMIN ✓
 *   anyone else → 404 (existence is not leaked)
 * On pass: 302 → short-lived signed URL (≤120s).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();

    const resume = await prisma.resume.findUnique({
      where: { id },
      include: {
        applications: { include: { job: { include: { company: true } } } },
      },
    });
    if (!resume) throw new ApiError(404, "Resume not found", "NOT_FOUND");

    let allowed = false;
    if (resume.candidateId === user.id) allowed = true;
    else if (user.role === "ADMIN") allowed = true;
    else if (user.role === "EMPLOYER") {
      allowed = resume.applications.some((a) => a.job.company.ownerUserId === user.id);
    }
    if (!allowed) throw new ApiError(404, "Resume not found", "NOT_FOUND");

    const url = await getStorage().getDownloadUrl(resume.storageKey, 120);
    // Local provider returns a relative path — absolutize for NextResponse.redirect
    const absolute = new URL(url, req.url).toString();
    return NextResponse.redirect(absolute, 302);
  } catch (e) {
    return handleApiError(e);
  }
}
