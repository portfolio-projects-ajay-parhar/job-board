import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-guards";
import { handleApiError } from "@/lib/errors";

/**
 * GET /api/jobs/[slug] — public job detail.
 * DRAFT → 404 unless owner/admin; increments viewCount for public views.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const job = await prisma.job.findUnique({
      where: { slug },
      include: {
        company: {
          select: { id: true, name: true, slug: true, logoUrl: true, isVerified: true, ownerUserId: true },
        },
      },
    });
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

    const viewer = await getSessionUser();
    const isOwner = viewer?.role === "EMPLOYER" && job.company.ownerUserId === viewer.id;
    const isAdmin = viewer?.role === "ADMIN";

    if (job.status === "DRAFT" && !isOwner && !isAdmin) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    const { company, ...detail } = job;
    const { ownerUserId, ...publicCompany } = company;

    if (job.status === "PUBLISHED") {
      // fire-and-forget view counting (dedupe not required)
      prisma.job.update({ where: { id: job.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
    }

    return NextResponse.json({ ...detail, company: publicCompany });
  } catch (e) {
    return handleApiError(e);
  }
}
