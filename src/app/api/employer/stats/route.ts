import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployer } from "@/lib/auth-guards";
import { handleApiError } from "@/lib/errors";

/** GET /api/employer/stats — dashboard KPIs + per-job funnel + recent activity. */
export async function GET() {
  try {
    const { company } = await requireEmployer();

    const weekAgo = new Date(Date.now() - 7 * 86_400_000);

    const [activeJobs, totalJobs, applicationsTotal, applicationsThisWeek, byJobStatus, recent] =
      await Promise.all([
        prisma.job.count({ where: { companyId: company.id, status: "PUBLISHED" } }),
        prisma.job.count({ where: { companyId: company.id } }),
        prisma.application.count({ where: { job: { companyId: company.id } } }),
        prisma.application.count({
          where: { job: { companyId: company.id }, submittedAt: { gte: weekAgo } },
        }),
        prisma.application.groupBy({
          by: ["jobId", "status"],
          where: { job: { companyId: company.id } },
          _count: { status: true },
        }),
        prisma.application.findMany({
          where: { job: { companyId: company.id } },
          orderBy: { lastStatusAt: "desc" },
          take: 8,
          include: {
            job: { select: { title: true, slug: true } },
            candidate: { select: { name: true } },
          },
        }),
      ]);

    // Per-job funnel counts
    const jobs = await prisma.job.findMany({
      where: { companyId: company.id, status: { in: ["PUBLISHED", "CLOSED"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, title: true, status: true },
    });
    const funnel = jobs.map((j) => {
      const counts: Record<string, number> = {
        SUBMITTED: 0,
        IN_REVIEW: 0,
        INTERVIEW: 0,
        OFFER: 0,
        HIRED: 0,
        REJECTED: 0,
        WITHDRAWN: 0,
      };
      for (const row of byJobStatus) {
        if (row.jobId === j.id) counts[row.status] = row._count.status;
      }
      return { ...j, counts };
    });

    return NextResponse.json({
      activeJobs,
      totalJobs,
      applicationsTotal,
      applicationsThisWeek,
      funnel,
      recent: recent.map((r) => ({
        id: r.id,
        jobTitle: r.job.title,
        jobSlug: r.job.slug,
        candidateName: r.candidate.name,
        status: r.status,
        lastStatusAt: r.lastStatusAt,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
