import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";

/** GET /api/companies/[slug] — public profile + open (PUBLISHED) roles. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const company = await prisma.company.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        website: true,
        description: true,
        location: true,
        industry: true,
        size: true,
        foundedYear: true,
        isVerified: true,
        jobs: {
          where: { status: "PUBLISHED" },
          select: {
            id: true,
            slug: true,
            title: true,
            location: true,
            locationType: true,
            type: true,
            experienceLevel: true,
            salaryMinCents: true,
            salaryMaxCents: true,
            salaryPeriod: true,
            publishedAt: true,
          },
          orderBy: { publishedAt: "desc" },
        },
      },
    });
    if (!company) return Response.json({ error: "Company not found" }, { status: 404 });

    const { jobs, ...profile } = company;
    return NextResponse.json({ ...profile, openJobs: jobs.length, jobs });
  } catch (e) {
    return handleApiError(e);
  }
}
