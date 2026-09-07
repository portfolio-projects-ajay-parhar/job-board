import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyOwner } from "@/lib/auth-guards";
import { ApiError, handleApiError } from "@/lib/errors";
import { sanitizeRichText } from "@/lib/sanitize";
import { jobCreateSchema } from "@/lib/job-schema";

/** GET /api/employer/jobs/[id] — owner view of a single job (incl. drafts). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { job } = await requireCompanyOwner(id);
    if (!job) throw new ApiError(404, "Job not found", "NOT_FOUND");
    return NextResponse.json(job);
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/employer/jobs/[id] — edit while DRAFT/PUBLISHED. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const owned = await requireCompanyOwner(id);
    const job = owned.job;
    if (!job) throw new ApiError(404, "Job not found", "NOT_FOUND");

    if (!["DRAFT", "PUBLISHED"].includes(job.status)) {
      throw new ApiError(422, "Closed jobs must be reopened before editing", "INVALID_STATUS");
    }

    const data = jobCreateSchema.parse(await req.json());

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        title: data.title,
        description: sanitizeRichText(data.description),
        responsibilities: data.responsibilities ? sanitizeRichText(data.responsibilities) : null,
        requirements: data.requirements ? sanitizeRichText(data.requirements) : null,
        benefits: data.benefits ? sanitizeRichText(data.benefits) : null,
        type: data.type,
        locationType: data.locationType,
        location: data.location,
        country: data.country,
        category: data.category,
        experienceLevel: data.experienceLevel,
        salaryMinCents: data.salaryMinCents,
        salaryMaxCents: data.salaryMaxCents,
        salaryPeriod: data.salaryPeriod,
        applicationDeadline: data.applicationDeadline ?? null,
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/employer/jobs/[id] — soft archive only; applications preserved. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { job } = await requireCompanyOwner(id);
    if (!job) throw new ApiError(404, "Job not found", "NOT_FOUND");
    const updated = await prisma.job.update({ where: { id: job.id }, data: { status: "ARCHIVED" } });
    return NextResponse.json(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
