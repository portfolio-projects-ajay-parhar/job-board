import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { handleApiError } from "@/lib/errors";

/** GET /api/admin/jobs?q&status&page — moderation table. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    const status = req.nextUrl.searchParams.get("status");
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("pageSize")) || 20));

    const STATUSES = ["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"] as const;
    const where = {
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
      ...(status && (STATUSES as readonly string[]).includes(status)
        ? { status: status as (typeof STATUSES)[number] }
        : {}),
    };

    const [total, jobs] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          company: { select: { name: true } },
          _count: { select: { applications: true } },
        },
      }),
    ]);
    return NextResponse.json({
      items: jobs.map(({ _count, ...j }) => ({ ...j, applicationCount: _count.applications })),
      total,
      page,
      pageSize,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
