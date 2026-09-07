import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [jobs, companies] = await Promise.all([
    prisma.job.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
    }),
    prisma.company.findMany({ select: { slug: true, updatedAt: true } }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = ["", "/jobs", "/companies", "/signin", "/signup"].map(
    (path) => ({ url: `${base}${path}`, changeFrequency: "daily", priority: path === "" ? 1 : 0.7 }),
  );

  return [
    ...staticRoutes,
    ...jobs.map((j) => ({
      url: `${base}/jobs/${j.slug}`,
      lastModified: j.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
    ...companies.map((c) => ({
      url: `${base}/companies/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
