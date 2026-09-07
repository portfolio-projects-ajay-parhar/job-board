import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployer } from "@/lib/auth-guards";
import { handleApiError } from "@/lib/errors";

const STATUSES = ["SUBMITTED", "IN_REVIEW", "INTERVIEW", "OFFER", "HIRED", "REJECTED", "WITHDRAWN"] as const;

/** GET /api/employer/applications?status&jobId&page — cross-job pipeline list. */
export async function GET(req: NextRequest) {
  try {
    const { company } = await requireEmployer();

    const status = req.nextUrl.searchParams.get("status");
    const jobId = req.nextUrl.searchParams.get("jobId");
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("pageSize")) || 20));

    const where = {
      job: { companyId: company.id, ...(jobId ? { id: jobId } : {}) },
      ...(status && (STATUSES as readonly string[]).includes(status)
        ? { status: status as (typeof STATUSES)[number] }
        : {}),
    };

    const [total, applications] = await Promise.all([
      prisma.application.count({ where }),
      prisma.application.findMany({
        where,
        orderBy: { lastStatusAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          job: { select: { id: true, title: true, slug: true } },
          candidate: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return NextResponse.json({ items: applications, total, page, pageSize });
  } catch (e) {
    return handleApiError(e);
  }
}
