import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatSalary } from "@/lib/salary";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const company = await prisma.company.findUnique({ where: { slug }, select: { name: true } });
  return { title: company?.name ?? "Company" };
}

export default async function CompanyDetailPage({ params }: Props) {
  const { slug } = await params;
  const company = await prisma.company.findUnique({
    where: { slug },
    include: {
      jobs: {
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
      },
    },
  });
  if (!company) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">{company.name}</h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              {[company.industry, company.location, company.foundedYear && `Founded ${company.foundedYear}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {company.isVerified && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">
              ✓ Verified
            </span>
          )}
        </div>
        {company.description && (
          <p className="mt-4 max-w-2xl text-slate-600 dark:text-slate-300">{company.description.replace(/<[^>]*>/g, "")}</p>
        )}
        {company.website && (
          <a href={company.website} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">
            {company.website}
          </a>
        )}
      </div>

      <h2 className="mt-10 text-xl font-bold text-slate-900 dark:text-slate-100">
        Open roles ({company.jobs.length})
      </h2>
      <div className="mt-4 flex flex-col gap-3">
        {company.jobs.map((job) => (
          <Link
            key={job.id}
            href={`/jobs/${job.slug}`}
            className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <p className="font-medium text-slate-900 dark:text-slate-100">{job.title}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {[job.location, job.locationType, job.type].filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium text-slate-700 sm:text-right dark:text-slate-300">
              {formatSalary(job.salaryMinCents, job.salaryMaxCents, job.salaryPeriod)}
            </span>
          </Link>
        ))}
        {company.jobs.length === 0 && (
          <p className="py-6 text-center text-slate-500 dark:text-slate-400">No open roles right now.</p>
        )}
      </div>
    </div>
  );
}
