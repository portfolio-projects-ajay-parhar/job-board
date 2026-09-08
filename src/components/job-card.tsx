import Link from "next/link";
import { formatSalary } from "@/lib/salary";

export type JobCardData = {
  slug: string;
  title: string;
  locationType: string;
  location: string | null;
  type: string;
  experienceLevel?: string;
  salaryMinCents: number | null;
  salaryMaxCents: number | null;
  salaryPeriod: string;
  featured?: boolean;
  publishedAt?: Date | string | null;
  companyName: string;
  companySlug?: string;
  isVerified?: boolean;
};

const postedAgo = (date?: Date | string | null): string => {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

const chip = "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300";

export function JobCard({ job }: { job: JobCardData }) {
  const posted = postedAgo(job.publishedAt);

  return (
    <Link
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
          {job.isVerified && <span className="ml-1 text-emerald-600 dark:text-emerald-400" title="Verified company">✓</span>}
          {job.location ? ` · ${job.location}` : ""}
          {" · "}
          {[job.locationType, job.type, job.experienceLevel].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {job.locationType === "REMOTE" && <span className={chip}>Remote</span>}
          {posted && <span className={chip}>{`Posted ${posted}`}</span>}
        </div>
      </div>
      <span className="shrink-0 text-sm font-medium text-slate-700 sm:text-right dark:text-slate-300">
        {formatSalary(job.salaryMinCents, job.salaryMaxCents, job.salaryPeriod as never)}
      </span>
    </Link>
  );
}
