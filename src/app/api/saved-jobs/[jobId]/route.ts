import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCandidate } from "@/lib/auth-guards";
import { handleApiError } from "@/lib/errors";

/** PUT /api/saved-jobs/[jobId] — save (idempotent via unique constraint). */
export async function PUT(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    const { user } = await requireCandidate();

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

    try {
      await prisma.savedJob.create({ data: { candidateId: user.id, jobId } });
      return NextResponse.json({ saved: true }, { status: 201 });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        return NextResponse.json({ saved: true, alreadySaved: true }); // idempotent re-click
      }
      throw e;
    }
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/saved-jobs/[jobId] — unsave (idempotent). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    const { user } = await requireCandidate();

    await prisma.savedJob.deleteMany({ where: { candidateId: user.id, jobId } });
    return NextResponse.json({ saved: false });
  } catch (e) {
    return handleApiError(e);
  }
}
