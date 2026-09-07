import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCompanyOwner } from "@/lib/auth-guards";
import { ApiError, handleApiError } from "@/lib/errors";
import { assertJobTransition } from "@/lib/job-status";

const statusSchema = z.object({
  status: z.enum(["PUBLISHED", "CLOSED", "ARCHIVED"]),
});

/** PATCH /api/employer/jobs/[id]/status — move the job through its machine. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { job } = await requireCompanyOwner(id);
    if (!job) throw new ApiError(404, "Job not found", "NOT_FOUND");
    const { status } = statusSchema.parse(await req.json());

    assertJobTransition(job.status, status);

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status,
        ...(status === "PUBLISHED" && !job.publishedAt ? { publishedAt: new Date() } : {}),
        ...(status === "CLOSED" ? { closesAt: new Date() } : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
