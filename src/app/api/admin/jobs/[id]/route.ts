import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { ApiError, handleApiError } from "@/lib/errors";

const patchSchema = z.object({
  featured: z.boolean().optional(),
  close: z.boolean().optional(),
});

/**
 * PATCH /api/admin/jobs/[id] — feature/unfeature, or close as moderation.
 * `close: true` is an explicit admin override of the employer status machine
 * (any non-ARCHIVED status → CLOSED) — documented moderation behavior.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { featured, close } = patchSchema.parse(await req.json());

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) throw new ApiError(404, "Job not found", "NOT_FOUND");
    void job;

    if (close) {
      if (job.status === "ARCHIVED") {
        throw new ApiError(422, "Archived jobs cannot be closed", "INVALID_STATUS");
      }
      const updated = await prisma.job.update({
        where: { id },
        data: { status: "CLOSED", closesAt: job.closesAt ?? new Date(), featured: false },
      });
      return NextResponse.json(updated);
    }

    if (featured !== undefined) {
      const updated = await prisma.job.update({ where: { id }, data: { featured } });
      return NextResponse.json(updated);
    }

    throw new ApiError(400, "Nothing to update", "BAD_REQUEST");
  } catch (e) {
    return handleApiError(e);
  }
}