import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCandidate } from "@/lib/auth-guards";
import { handleApiError } from "@/lib/errors";

const profileSchema = z.object({
  fullName: z.string().min(1).max(120),
  headline: z.string().max(120).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  bio: z.string().max(5000).optional().nullable(),
  skills: z.array(z.string().min(1).max(40)).max(20).default([]),
  portfolioUrl: z.string().url().max(200).optional().nullable().or(z.literal("")),
  githubUrl: z.string().url().max(200).optional().nullable().or(z.literal("")),
  linkedinUrl: z.string().url().max(200).optional().nullable().or(z.literal("")),
  yearsOfExperience: z.number().int().min(0).max(60).optional().nullable(),
});

/** GET /api/profile — the signed-in candidate's profile. */
export async function GET() {
  try {
    const { profile } = await requireCandidate();
    return NextResponse.json(profile);
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/profile — update the signed-in candidate's profile. */
export async function PATCH(req: NextRequest) {
  try {
    const { profile } = await requireCandidate();
    const data = profileSchema.parse(await req.json());

    // normalize skills: trim, dedupe, drop empties
    const skills = [...new Set(data.skills.map((s) => s.trim()).filter(Boolean))].slice(0, 20);

    const updated = await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: {
        ...data,
        skills,
        portfolioUrl: data.portfolioUrl || null,
        githubUrl: data.githubUrl || null,
        linkedinUrl: data.linkedinUrl || null,
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
