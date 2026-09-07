import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployer } from "@/lib/auth-guards";
import { ApiError, handleApiError } from "@/lib/errors";
import { assertApplicationTransition } from "@/lib/application-status";
import { sendEmailSafe, appUrl } from "@/lib/email";

const bodySchema = z.object({
  status: z.enum(["IN_REVIEW", "INTERVIEW", "OFFER", "HIRED", "REJECTED"]),
  note: z.string().max(2000).optional(),
});

/** PATCH /api/employer/applications/[id] — validated transition + audit + (Phase 8) email. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user, company } = await requireEmployer();

    const application = await prisma.application.findUnique({
      where: { id },
      include: { job: true },
    });
    if (!application) throw new ApiError(404, "Application not found", "NOT_FOUND");
    if (application.job.companyId !== company.id) {
      throw new ApiError(403, "Forbidden", "FORBIDDEN");
    }

    const { status, note } = bodySchema.parse(await req.json());
    assertApplicationTransition(application.status, status); // 422 INVALID_TRANSITION

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const updated = await tx.application.update({
        where: { id },
        data: {
          status,
          lastStatusAt: now,
          ...(note !== undefined ? { employerNote: note } : {}),
        },
      });
      await tx.applicationEvent.create({
        data: {
          applicationId: id,
          fromStatus: application.status,
          toStatus: status,
          note: note ?? null,
          actorId: user.id,
        },
      });
      return updated;
    });

    // Phase 8: post-commit email to the candidate (never blocking)
    const recipient = await prisma.user.findUnique({
      where: { id: updated.candidateId },
      select: { email: true, name: true },
    });
    if (recipient) {
      sendEmailSafe({
        to: recipient.email,
        template: "application-status-changed",
        data: {
          name: recipient.name ?? "there",
          jobTitle: application.job.title,
          jobSlug: application.job.slug,
          status,
          url: appUrl("/account/applications"),
        },
      });
    }

    return NextResponse.json(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
