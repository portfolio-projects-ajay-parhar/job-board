import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyOwner } from "@/lib/auth-guards";
import { handleApiError } from "@/lib/errors";

const STATUSES = ["SUBMITTED", "IN_REVIEW", "INTERVIEW", "OFFER", "HIRED", "REJECTED", "WITHDRAWN"] as const;

/** GET /api/employer/jobs/[id]/applications?status&page — pipeline for one job. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { job } = await requireCompanyOwner(id);
    if (!job) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    const status = req.nextUrl.searchParams.get("status");
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("pageSize")) || 20));

    const where = {
      jobId: job.id,
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
          candidate: { select: { id: true, name: true, email: true } },
          resume: { select: { id: true, fileName: true, mimeType: true } },
        },
      }),
    ]);

    // Candidate profile summary (headline + top-5 skills)
    const profiles = await prisma.candidateProfile.findMany({
      where: { userId: { in: applications.map((a) => a.candidate.id) } },
      select: { userId: true, headline: true, skills: true },
    });
    const profileByUser = new Map(profiles.map((p) => [p.userId, p]));

    return NextResponse.json({
      items: applications.map((a) => ({
        id: a.id,
        status: a.status,
        coverLetter: a.coverLetter,
        submittedAt: a.submittedAt,
        lastStatusAt: a.lastStatusAt,
        candidate: {
          id: a.candidate.id,
          name: a.candidate.name,
          email: a.candidate.email,
          headline: profileByUser.get(a.candidate.id)?.headline ?? null,
          skills: (profileByUser.get(a.candidate.id)?.skills ?? []).slice(0, 5),
        },
        resume: a.resume,
      })),
      total,
      page,
      pageSize,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
