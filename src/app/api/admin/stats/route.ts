import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { handleApiError } from "@/lib/errors";

/** GET /api/admin/stats — platform KPIs + 30-day signup/application series. */
export async function GET() {
  try {
    await requireAdmin();

    const [usersByRole, companyTotal, companyVerified, jobsByStatus, appsByStatus] = await Promise.all([
      prisma.user.groupBy({ by: ["role"], _count: { role: true } }),
      prisma.company.count(),
      prisma.company.count({ where: { isVerified: true } }),
      prisma.job.groupBy({ by: ["status"], _count: { status: true } }),
      prisma.application.groupBy({ by: ["status"], _count: { status: true } }),
    ]);

    const series = await prisma.$queryRaw<{ day: Date; signups: bigint; applications: bigint }[]>`
      SELECT d::date AS day,
        (SELECT count(*) FROM "User" u WHERE u."createdAt"::date = d::date) AS signups,
        (SELECT count(*) FROM "Application" a WHERE a."submittedAt"::date = d::date) AS applications
      FROM generate_series(now()::date - interval '29 days', now()::date, interval '1 day') d
      ORDER BY d`;

    return NextResponse.json({
      usersByRole: Object.fromEntries(usersByRole.map((r) => [r.role, r._count.role])),
      companies: { total: companyTotal, verified: companyVerified },
      jobsByStatus: Object.fromEntries(jobsByStatus.map((r) => [r.status, r._count.status])),
      applicationsByStatus: Object.fromEntries(appsByStatus.map((r) => [r.status, r._count.status])),
      series: series.map((s) => ({
        day: s.day.toISOString().slice(0, 10),
        signups: Number(s.signups),
        applications: Number(s.applications),
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
