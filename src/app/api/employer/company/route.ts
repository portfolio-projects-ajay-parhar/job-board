import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireEmployer } from "@/lib/auth-guards";
import { ApiError, handleApiError } from "@/lib/errors";

const patchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  website: z.string().url().max(200).optional().or(z.literal("")),
  description: z.string().max(5000).optional(),
  location: z.string().max(100).optional(),
  industry: z.string().max(100).optional(),
  size: z.enum(["STARTUP_1_10", "SMALL_11_50", "MEDIUM_51_200", "LARGE_201_1000", "ENTERPRISE_1000_PLUS"]).optional(),
  foundedYear: z.number().int().min(1800).max(2100).optional().nullable(),
  logoUrl: z.string().max(500).optional().or(z.literal("")),
});

export async function GET() {
  try {
    const { company } = await requireEmployer();
    return NextResponse.json(company);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user, company } = await requireEmployer();
    const data = patchSchema.parse(await req.json());

    // logoUrl must reference a media key this employer uploaded
    if (data.logoUrl) {
      if (!data.logoUrl.startsWith(`media/${user.id}/`)) {
        throw new ApiError(400, "logoUrl must reference media uploaded by you", "INVALID_LOGO");
      }
    }

    const updated = await prisma.company.update({
      where: { id: company.id },
      data: {
        ...data,
        website: data.website === "" ? null : data.website,
        logoUrl: data.logoUrl === "" ? null : data.logoUrl,
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
