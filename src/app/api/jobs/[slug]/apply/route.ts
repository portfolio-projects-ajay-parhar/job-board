import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCandidate } from "@/lib/auth-guards";
import { ApiError, handleApiError } from "@/lib/errors";
import { sendEmailSafe, appUrl } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sanitizeRichText } from "@/lib/sanitize";

const applySchema = z.object({
  resumeId: z.string().min(1),
  coverLetter: z.string().max(5000).optional(),
});

/** POST /api/jobs/[slug]/apply — CANDIDATE applies with full guards (slug or job id). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { user } = await requireCandidate();

    const rl = rateLimit(`apply:${clientIp(req)}`, 20, 60_000);
    if (!rl.ok) throw new ApiError(429, "Too many requests — try again shortly", "RATE_LIMITED");

    const body = applySchema.parse(await req.json());

    // 1. Job exists (by slug or id) and is PUBLISHED
    const job =
      (await prisma.job.findUnique({ where: { slug } })) ??
      (await prisma.job.findUnique({ where: { id: slug } }));
    if (!job) throw new ApiError(404, "Job not found", "NOT_FOUND");
    if (job.status !== "PUBLISHED") {
      throw new ApiError(409, "This job is not accepting applications", "NOT_PUBLISHED");
    }

    // 2. Deadline guard
    if (job.applicationDeadline && job.applicationDeadline.getTime() < Date.now()) {
      throw new ApiError(422, "The application deadline for this job has passed", "DEADLINE_PASSED");
    }

    // 3. Resume ownership
    const resume = await prisma.resume.findUnique({ where: { id: body.resumeId } });
    if (!resume || resume.candidateId !== user.id) {
      throw new ApiError(403, "Resume not found or not owned by you", "INVALID_RESUME");
    }

    // 4+5. One transaction: application + audit event; P2002 → friendly 409
    const now = new Date();
    try {
      const application = await prisma.$transaction(async (tx) => {
        const application = await tx.application.create({
          data: {
            jobId: job.id,
            candidateId: user.id,
            resumeId: resume.id,
            coverLetter: body.coverLetter ? sanitizeRichText(body.coverLetter) : null,
            status: "SUBMITTED",
            submittedAt: now,
            lastStatusAt: now,
          },
        });
        await tx.applicationEvent.create({
          data: {
            applicationId: application.id,
            fromStatus: null,
            toStatus: "SUBMITTED",
            note: "Application received",
            actorId: user.id,
          },
        });
        return application;
      });

      // Phase 8: post-commit emails — employer + candidate confirmations (never blocking)
      const jobDetail = await prisma.job.findUnique({
        where: { id: job.id },
        select: {
          title: true,
          slug: true,
          company: { select: { name: true, owner: { select: { email: true } } } },
        },
      });
      if (jobDetail) {
        sendEmailSafe({
          to: jobDetail.company.owner.email,
          template: "application-received",
          data: {
            candidateName: user.name ?? "A candidate",
            jobTitle: jobDetail.title,
            companyName: jobDetail.company.name,
            url: appUrl(`/employer/jobs/${job.id}/applications`),
          },
        });
      }
      sendEmailSafe({
        to: user.email ?? "",
        template: "application-confirmation",
        data: {
          name: user.name ?? "there",
          jobTitle: job.title,
          companyName: "",
          url: appUrl("/account/applications"),
        },
      });

      return NextResponse.json(application, { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ApiError(409, "You have already applied to this job", "ALREADY_APPLIED");
      }
      throw e;
    }
  } catch (e) {
    return handleApiError(e);
  }
}
