import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { searchJobs } from "@/lib/search";
import { handleApiError } from "@/lib/errors";

const querySchema = z.object({
  q: z.string().max(200).optional(),
  type: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "TEMPORARY"]).optional(),
  locationType: z.enum(["ONSITE", "REMOTE", "HYBRID"]).optional(),
  experienceLevel: z.enum(["ENTRY", "MID", "SENIOR", "LEAD"]).optional(),
  category: z
    .enum(["ENGINEERING", "DESIGN", "PRODUCT", "MARKETING", "SALES", "DATA", "OPERATIONS", "FINANCE", "HR", "OTHER"])
    .optional(),
  minSalary: z.coerce.number().int().min(0).optional(),
  maxSalary: z.coerce.number().int().min(0).optional(),
  remote: z.enum(["true", "false"]).optional(),
  postedWithin: z.enum(["24h", "7d", "30d"]).optional(),
  sort: z.enum(["relevant", "newest", "salary_desc"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

/** GET /api/jobs — public ranked search + filters + offset pagination. */
export async function GET(req: NextRequest) {
  try {
    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const p = querySchema.parse(raw);

    const result = await searchJobs(prisma, {
      q: p.q,
      type: p.type,
      locationType: p.locationType,
      experienceLevel: p.experienceLevel,
      category: p.category,
      minSalary: p.minSalary,
      maxSalary: p.maxSalary,
      remote: p.remote === undefined ? undefined : p.remote === "true",
      postedWithin: p.postedWithin,
      sort: p.sort,
      page: p.page,
      pageSize: p.pageSize,
    });

    return NextResponse.json(result);
  } catch (e) {
    return handleApiError(e);
  }
}
