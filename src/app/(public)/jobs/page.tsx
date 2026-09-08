import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { searchJobs } from "@/lib/search";
import { formatSalary } from "@/lib/salary";
import { JobSearchControls } from "./search-controls";

export const metadata: Metadata = { title: "Search jobs" };

type SP = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default async function JobsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const result = await searchJobs(prisma, {
    q: one(sp.q),
    type: one(sp.type),
    locationType: one(sp.locationType),
    experienceLevel: one(sp.experienceLevel),
    category: one(sp.category),
    minSalary: one(sp.minSalary) ? Number(one(sp.minSalary)) : undefined,
    maxSalary: one(sp.maxSalary) ? Number(one(sp.maxSalary)) : undefined,
    remote: one(sp.remote) === "true",
    postedWithin: one(sp.postedWithin) as never,
    sort: one(sp.sort) as never,
    page,
    pageSize: 20,
  });

  const hasFilters = Object.keys(sp).some((k) => k !== "page" && one(sp[k]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Search jobs</h1>

      <JobSearchControls />

      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
        Page {result.page} of {result.totalPages} · {result.total} result{result.total === 1 ? "" : "s"}
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {result.jobs.map((job) => (
          <Link
            key={job.id}
            href={`/jobs/${job.slug}`}
            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                {job.title}
                {job.featured && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-400">
                    Featured
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {job.companyName}
                {job.isVerified && <span className="ml-1 text-emerald-600 dark:text-emerald-400">✓</span>}
                {" · "}
                {[job.location, job.locationType, job.type, job.experienceLevel]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium text-slate-700 sm:text-right dark:text-slate-300">
              {formatSalary(job.salaryMinCents, job.salaryMaxCents, job.salaryPeriod as never)}
            </span>
          </Link>
        ))}

        {result.jobs.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-slate-600 dark:text-slate-300">No jobs match your search.</p>
            {hasFilters && (
              <Link href="/jobs" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                Clear all filters
              </Link>
            )}
          </div>
        )}
      </div>

      {result.totalPages > 1 && (
        <div className="mt-8 flex flex-wrap justify-center gap-2 text-sm">
          {Array.from({ length: result.totalPages }, (_, i) => {
            const params = new URLSearchParams(
              Object.entries(sp)
                .filter(([, v]) => one(v))
                .map(([k, v]) => [k, String(one(v))]),
            );
            params.set("page", String(i + 1));
            return (
              <Link
                key={i}
                href={`/jobs?${params.toString()}`}
                className={`rounded-md px-3 py-1.5 ${
                  i + 1 === result.page
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                }`}
              >
                {i + 1}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
