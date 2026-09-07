import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { handleApiError } from "@/lib/errors";

/** GET /api/admin/users?q&page — user directory (read-only; role changes are DB-managed). */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("pageSize")) || 20));

    const where = q ? { email: { contains: q, mode: "insensitive" as const } } : {};
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          _count: { select: { applications: true } },
          company: { select: { _count: { select: { jobs: true } } } },
        },
      }),
    ]);

    return NextResponse.json({
      items: users.map(({ _count, company, ...u }) => ({
        ...u,
        applicationsCount: _count.applications,
        jobsCount: company?._count.jobs ?? 0,
      })),
      total,
      page,
      pageSize,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
