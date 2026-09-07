import { z } from "zod";

/** Shared create/edit payload schema for employer jobs. */
export const jobCreateSchema = z
  .object({
    title: z.string().min(3).max(120),
    description: z.string().min(50),
    responsibilities: z.string().max(20000).optional(),
    requirements: z.string().max(20000).optional(),
    benefits: z.string().max(20000).optional(),
    type: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "TEMPORARY"]),
    locationType: z.enum(["ONSITE", "REMOTE", "HYBRID"]),
    location: z.string().max(120).optional(),
    country: z.string().max(80).optional(),
    category: z.enum(["ENGINEERING", "DESIGN", "PRODUCT", "MARKETING", "SALES", "DATA", "OPERATIONS", "FINANCE", "HR", "OTHER"]),
    experienceLevel: z.enum(["ENTRY", "MID", "SENIOR", "LEAD"]),
    salaryMinCents: z.number().int().positive().optional(),
    salaryMaxCents: z.number().int().positive().optional(),
    salaryPeriod: z.enum(["YEAR", "MONTH", "WEEK", "DAY", "HOUR"]),
    applicationDeadline: z.coerce.date().optional().nullable(),
    publish: z.boolean().default(false),
  })
  .refine((d) => !["ONSITE", "HYBRID"].includes(d.locationType) || !!d.location, {
    message: "Location required for onsite/hybrid roles",
    path: ["location"],
  })
  .refine((d) => !d.salaryMinCents || !d.salaryMaxCents || d.salaryMinCents <= d.salaryMaxCents, {
    message: "Minimum salary must be ≤ maximum salary",
    path: ["salaryMinCents"],
  });
