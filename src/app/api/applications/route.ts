import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCandidate } from "@/lib/auth-guards";
import { handleApiError } from "@/lib/errors";

const STATUSES = ["SUBMITTED", "IN_REVIEW", "INTERVIEW", "OFFER", "HIRED", "REJECTED", "WITHDRAWN"] as const;

/** GET /api/applications?page&status — the candidate's own tracker rows. */
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireCandidate();

    const status = req.nextUrl.searchParams.get("status");
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("pageSize")) || 20));

    const where = {
      candidateId: user.id,
      ...(status && (STATUSES as readonly string[]).includes(status)
        ? { status: status as (typeof STATUSES)[number] }
        : {}),
    };

    const [total, applications] = await Promise.all([
      prisma.application.count({ where }),
      prisma.application.findMany({
        where,
        orderBy: { submittedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          job: {
            select: { id: true, title: true, slug: true, company: { select: { name: true, slug: true } } },
          },
          resume: { select: { fileName: true } },
          events: { orderBy: { createdAt: "asc" } },
        },
      }),
    ]);

    return NextResponse.json({ items: applications, total, page, pageSize });
  } catch (e) {
    return handleApiError(e);
  }
}
