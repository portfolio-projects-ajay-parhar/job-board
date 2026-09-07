import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCandidate } from "@/lib/auth-guards";
import { ApiError, handleApiError } from "@/lib/errors";
import { getStorage } from "@/lib/storage";

/** PATCH /api/resumes/[id] — set as primary (demotes the previous primary). */
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user } = await requireCandidate();

    const resume = await prisma.resume.findUnique({ where: { id } });
    if (!resume || resume.candidateId !== user.id) {
      throw new ApiError(404, "Resume not found", "NOT_FOUND");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.resume.updateMany({ where: { candidateId: user.id, isPrimary: true }, data: { isPrimary: false } });
      return tx.resume.update({ where: { id }, data: { isPrimary: true } });
    });
    return NextResponse.json(updated);
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/resumes/[id] — 409 when referenced by an application. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user } = await requireCandidate();

    const resume = await prisma.resume.findUnique({ where: { id } });
    if (!resume || resume.candidateId !== user.id) {
      throw new ApiError(404, "Resume not found", "NOT_FOUND");
    }

    const usedBy = await prisma.application.count({ where: { resumeId: id } });
    if (usedBy > 0) {
      throw new ApiError(
        409,
        `Resume is attached to ${usedBy} application${usedBy === 1 ? "" : "s"} and cannot be deleted`,
        "RESUME_IN_USE",
      );
    }

    await getStorage().delete(resume.storageKey);
    await prisma.resume.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
