import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCandidate } from "@/lib/auth-guards";
import { ApiError, handleApiError } from "@/lib/errors";
import { assertApplicationTransition } from "@/lib/application-status";

/** PATCH /api/applications/[id]/withdraw — candidate owner, machine-validated. */
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { user } = await requireCandidate();

    const application = await prisma.application.findUnique({ where: { id } });
    if (!application || application.candidateId !== user.id) {
      throw new ApiError(404, "Application not found", "NOT_FOUND");
    }

    assertApplicationTransition(application.status, "WITHDRAWN"); // 422 when terminal/HIRED

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const updated = await tx.application.update({
        where: { id },
        data: { status: "WITHDRAWN", lastStatusAt: now },
      });
      await tx.applicationEvent.create({
        data: {
          applicationId: id,
          fromStatus: application.status,
          toStatus: "WITHDRAWN",
          note: "Candidate withdrew",
          actorId: user.id,
        },
      });
      return updated;
    });
    return NextResponse.json(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
