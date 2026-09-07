import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCandidate } from "@/lib/auth-guards";
import { handleApiError } from "@/lib/errors";

/** GET /api/saved-jobs?page — the candidate's saved jobs with summaries. */
export async function GET(req: NextRequest) {
  try {
    const { user } = await requireCandidate();
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("pageSize")) || 20));

    const [total, saved] = await Promise.all([
      prisma.savedJob.count({ where: { candidateId: user.id } }),
      prisma.savedJob.findMany({
        where: { candidateId: user.id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          job: {
            select: {
              id: true,
              slug: true,
              title: true,
              status: true,
              location: true,
              locationType: true,
              type: true,
              salaryMinCents: true,
              salaryMaxCents: true,
              salaryPeriod: true,
              company: { select: { name: true, slug: true, isVerified: true } },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({ items: saved, total, page, pageSize });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/saved-jobs {jobId} — save (idempotent via unique constraint). */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireCandidate();
    const { jobId } = (await req.json()) as { jobId?: string };
    if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

    try {
      await prisma.savedJob.create({ data: { candidateId: user.id, jobId } });
      return NextResponse.json({ saved: true }, { status: 201 });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        return NextResponse.json({ saved: true, alreadySaved: true }); // idempotent
      }
      throw e;
    }
  } catch (e) {
    return handleApiError(e);
  }
}
