import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployer } from "@/lib/auth-guards";
import { handleApiError } from "@/lib/errors";
import { sanitizeRichText } from "@/lib/sanitize";
import { slugifyTitle, uniqueSlug } from "@/lib/slug";
import { jobCreateSchema } from "@/lib/job-schema";

/** POST /api/employer/jobs — create DRAFT or PUBLISHED job. */
export async function POST(req: NextRequest) {
  try {
    const { company } = await requireEmployer();
    const data = jobCreateSchema.parse(await req.json());

    const slug = await uniqueSlug(slugifyTitle(data.title), (s) =>
      prisma.job.findUnique({ where: { slug: s } }).then(Boolean),
    );

    const job = await prisma.job.create({
      data: {
        companyId: company.id,
        slug,
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
        status: data.publish ? "PUBLISHED" : "DRAFT",
        publishedAt: data.publish ? new Date() : null,
      },
    });
    return NextResponse.json(job, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}

/** GET /api/employer/jobs?status= — the employer's own job table. */
export async function GET(req: NextRequest) {
  try {
    const { company } = await requireEmployer();
    const status = req.nextUrl.searchParams.get("status");

    const jobs = await prisma.job.findMany({
      where: { companyId: company.id, ...(status ? { status: status as never } : {}) },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { applications: true } } },
    });

    return NextResponse.json({
      items: jobs.map(({ _count, ...job }) => ({ ...job, applicationCount: _count.applications })),
      total: jobs.length,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
