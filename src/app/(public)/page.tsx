import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { JobCard } from "@/components/job-card";

export default async function HomePage() {
  const [featured, recent, categories, topCompanies] = await Promise.all([
    prisma.job.findMany({
      where: { status: "PUBLISHED", featured: true },
      orderBy: { publishedAt: "desc" },
      take: 4,
      include: { company: { select: { name: true, isVerified: true } } },
    }),
    prisma.job.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 8,
      include: { company: { select: { name: true, isVerified: true } } },
    }),
    prisma.job.groupBy({
      by: ["category"],
      where: { status: "PUBLISHED" },
      _count: { category: true },
    }),
    prisma.company.findMany({
      where: { isVerified: true },
      orderBy: { name: "asc" },
      take: 6,
      include: { _count: { select: { jobs: { where: { status: "PUBLISHED" } } } } },
    }),
  ]);

  const categoryCount = new Map(categories.map((c) => [c.category, c._count.category]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Hero */}
      <section className="rounded-2xl bg-slate-900 px-6 py-10 text-center text-white sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Find your next role</h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-300">
          Full-text search across {categoryCount.size > 0 ? "thousands of" : ""} jobs from verified companies.
        </p>
        <form action="/jobs" className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
          <input
            name="q"
            placeholder='Try "senior react" or "node remote"'
            className="w-full rounded-md border-0 px-4 py-3 text-sm text-slate-900 focus:outline-none"
          />
          <button className="shrink-0 rounded-md bg-emerald-500 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-400">
            Search
          </button>
        </form>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {["ENGINEERING", "DESIGN", "PRODUCT", "DATA", "MARKETING"].map((cat) => (
            <Link
              key={cat}
              href={`/jobs?category=${cat}`}
              className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
            >
              {cat.charAt(0) + cat.slice(1).toLowerCase()} ({categoryCount.get(cat as never) ?? 0})
            </Link>
          ))}
        </div>
      </section>

      {/* Featured rail */}
      {featured.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Featured jobs</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {featured.map((job) => (
              <JobCard
                key={job.id}
                job={{
                  slug: job.slug,
                  title: job.title,
                  locationType: job.locationType,
                  location: job.location,
                  type: job.type,
                  experienceLevel: job.experienceLevel,
                  salaryMinCents: job.salaryMinCents,
                  salaryMaxCents: job.salaryMaxCents,
                  salaryPeriod: job.salaryPeriod,
                  featured: true,
                  publishedAt: job.publishedAt,
                  companyName: job.company.name,
                  isVerified: job.company.isVerified,
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent jobs */}
      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Recent jobs</h2>
          <Link href="/jobs" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
            Browse all →
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {recent.map((job) => (
            <JobCard
              key={job.id}
              job={{
                slug: job.slug,
                title: job.title,
                locationType: job.locationType,
                location: job.location,
                type: job.type,
                experienceLevel: job.experienceLevel,
                salaryMinCents: job.salaryMinCents,
                salaryMaxCents: job.salaryMaxCents,
                salaryPeriod: job.salaryPeriod,
                publishedAt: job.publishedAt,
                companyName: job.company.name,
                isVerified: job.company.isVerified,
              }}
            />
          ))}
        </div>
      </section>

      {/* Top verified companies */}
      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Verified companies</h2>
          <Link href="/companies" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
            All companies →
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topCompanies.map((c) => (
            <Link
              key={c.id}
              href={`/companies/${c.slug}`}
              className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</span>
                <span className="text-emerald-600 dark:text-emerald-400" title="Verified">✓</span>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{c.industry ?? c.location ?? "—"}</p>
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                {c._count.jobs} open role{c._count.jobs === 1 ? "" : "s"}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
