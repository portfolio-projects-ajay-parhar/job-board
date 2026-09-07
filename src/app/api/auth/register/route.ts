import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import slugify from "slugify";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiError } from "@/lib/errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    role: z.enum(["CANDIDATE", "EMPLOYER"]), // ADMIN is never accepted from input
    name: z.string().min(1),
    companyName: z.string().min(2).optional(),
  })
  .refine((d) => d.role !== "EMPLOYER" || !!d.companyName, {
    message: "Company name required",
    path: ["companyName"],
  });

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimit(`register:${clientIp(req)}`, 10, 60_000);
    if (!rl.ok) {
      throw new ApiError(429, "Too many attempts — try again shortly", "RATE_LIMITED");
    }

    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new ApiError(409, "An account with this email already exists", "EMAIL_TAKEN");

    const passwordHash = await bcrypt.hash(body.password, 12);

    if (body.role === "EMPLOYER") {
      const user = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email, name: body.name, passwordHash, role: "EMPLOYER" },
        });
        const slugBase = slugify(body.companyName!, { lower: true, strict: true });
        let slug = slugBase;
        let i = 1;
        while (await tx.company.findUnique({ where: { slug } })) {
          slug = `${slugBase}-${++i}`;
        }
        await tx.company.create({
          data: { ownerUserId: user.id, name: body.companyName!, slug, size: "STARTUP_1_10" },
        });
        return user;
      });
      return NextResponse.json({ id: user.id, role: user.role }, { status: 201 });
    }

    const user = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name: body.name, passwordHash, role: "CANDIDATE" },
      });
      await tx.candidateProfile.create({
        data: { userId: user.id, fullName: body.name },
      });
      return user;
    });
    return NextResponse.json({ id: user.id, role: user.role }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
