import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { handleApiError } from "@/lib/errors";

/** GET /api/admin/companies?q&page — moderation table. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("pageSize")) || 20));

    const where = q ? { name: { contains: q, mode: "insensitive" as const } } : {};
    const [total, companies] = await Promise.all([
      prisma.company.count({ where }),
      prisma.company.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          owner: { select: { email: true } },
          _count: { select: { jobs: true } },
        },
      }),
    ]);
    return NextResponse.json({
      items: companies.map(({ _count, owner, ...c }) => ({ ...c, ownerEmail: owner.email, jobsCount: _count.jobs })),
      total,
      page,
      pageSize,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
