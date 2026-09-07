import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guards";
import { ApiError, handleApiError } from "@/lib/errors";

const patchSchema = z.object({ isVerified: z.boolean() });

/** PATCH /api/admin/companies/[id] — verify / unverify. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { isVerified } = patchSchema.parse(await req.json());

    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Company not found", "NOT_FOUND");

    const company = await prisma.company.update({ where: { id }, data: { isVerified } });
    return NextResponse.json(company);
  } catch (e) {
    return handleApiError(e);
  }
}