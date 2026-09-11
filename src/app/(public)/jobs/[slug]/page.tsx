import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth-guards";
import { sanitizeRichText } from "@/lib/sanitize";
import { formatSalary } from "@/lib/salary";
import { JobCard } from "@/components/job-card";
import { JobActions } from "./job-actions";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const job = await prisma.job.findUnique({
    where: { slug },
    select: { title: true, company: { select: { name: true } } },
  });
  return {
    title: job ? `${job.title} at ${job.company.name}` : "Job",
    openGraph: job ? { title: `${job.title} at ${job.company.name}` } : undefined,
  };
}

const Section = ({ title, html }: { title: string; html: string | null }) =>
  html ? (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
      {/* sanitized on write AND at render — belt and braces */}
      <div
        className="mt-2 max-w-none text-sm leading-relaxed text-slate-600 dark:text-slate-300 [&_li]:ml-4 [&_li]:list-disc [&_p]:my-2 [&_ul]:my-2"
        dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }}
      />
    </section>
  ) : null;

export default async function JobDetailPage({ params }: Props) {
  const { slug } = await params;

  const job = await prisma.job.findUnique({
    where: { slug },
    include: {
      company: {
        select: { id: true, name: true, slug: true, logoUrl: true, website: true, isVerified: true, ownerUserId: true },
      },
    },
  });
  if (!job) notFound();

  const viewer = await getSessionUser();
  const isOwner = viewer?.role === "EMPLOYER" && job.company.ownerUserId === viewer.id;
  const isAdmin = viewer?.role === "ADMIN";
  if (job.status === "DRAFT" && !isOwner && !isAdmin) notFound();

  if (job.status === "PUBLISHED") {
    prisma.job.update({ where: { id: job.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
  }

  const related = await prisma.job.findMany({
    where: { status: "PUBLISHED", category: job.category, id: { not: job.id } },
    orderBy: { publishedAt: "desc" },
    take: 4,
    include: { company: { select: { name: true, isVerified: true } } },
  });

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description,
    datePosted: job.publishedAt?.toISOString(),
    validThrough: job.applicationDeadline?.toISOString(),
    employmentType: job.type,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company.name,
      logo: job.company.logoUrl ?? undefined,
    },
    ...(job.locationType === "REMOTE"
      ? { jobLocationType: "TELECOMMUTE" }
      : {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: job.location ?? undefined,
              addressCountry: job.country ?? undefined,
            },
          },
        }),
    ...(job.salaryMinCents || job.salaryMaxCents
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: "USD",
            value: {
              "@type": "QuantitativeValue",
              minValue: job.salaryMinCents ? job.salaryMinCents / 100 : undefined,
              maxValue: job.salaryMaxCents ? job.salaryMaxCents / 100 : undefined,
              unitText: job.salaryPeriod,
            },
          },
        }
      : {}),
  };

  const now = Date.now(); // eslint-disable-line react-hooks/purity -- server component evaluates once per request
  const deadlinePassed = job.applicationDeadline ? job.applicationDeadline.getTime() < now : false;
  const deadlineSoon =
    job.applicationDeadline && !deadlinePassed && job.applicationDeadline.getTime() - now < 7 * 86_400_000;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <nav className="text-sm text-slate-500 dark:text-slate-400">
        <Link href="/jobs" className="hover:underline">Jobs</Link>
        {" / "}
        <Link href={`/companies/${job.company.slug}`} className="hover:underline">{job.company.name}</Link>
      </nav>

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-slate-100">{job.title}</h1>
                <p className="mt-2 text-slate-500 dark:text-slate-400">
                  <Link href={`/companies/${job.company.slug}`} className="font-medium text-slate-700 hover:underline dark:text-slate-300">
                    {job.company.name}
                  </Link>
                  {job.company.isVerified && <span className="ml-1 text-emerald-600 dark:text-emerald-400" title="Verified">✓</span>}
                  {" · "}
                  {[job.location, job.locationType, job.type, job.experienceLevel].filter(Boolean).join(" · ")}
                  {job.viewCount > 0 ? ` · ${job.viewCount} views` : ""}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-800 dark:text-slate-200">
                  {formatSalary(job.salaryMinCents, job.salaryMaxCents, job.salaryPeriod)}
                </p>
              </div>
              {job.status !== "PUBLISHED" && (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-400">
                  {job.status === "CLOSED" ? "Closed" : "Draft"}
                </span>
              )}
            </div>

            {deadlinePassed && (
              <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
                ⚠ The application deadline for this role has passed.
              </p>
            )}
            {!deadlinePassed && deadlineSoon && (
              <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                ⏳ Applications close {job.applicationDeadline?.toLocaleDateString("en-US")} — apply soon!
              </p>
            )}

            <Section title="About the role" html={job.description} />
            <Section title="Responsibilities" html={job.responsibilities} />
            <Section title="Requirements" html={job.requirements} />
            <Section title="Benefits" html={job.benefits} />
          </div>

          {related.length > 0 && (
            <section className="mt-10">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Related {job.category.toLowerCase()} jobs</h2>
              <div className="mt-4 flex flex-col gap-3">
                {related.map((r) => (
                  <JobCard
                    key={r.id}
                    job={{
                      slug: r.slug,
                      title: r.title,
                      locationType: r.locationType,
                      location: r.location,
                      type: r.type,
                      experienceLevel: r.experienceLevel,
                      salaryMinCents: r.salaryMinCents,
                      salaryMaxCents: r.salaryMaxCents,
                      salaryPeriod: r.salaryPeriod,
                      publishedAt: r.publishedAt,
                      companyName: r.company.name,
                      isVerified: r.company.isVerified,
                    }}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <JobActions job={{ id: job.id, slug: job.slug, status: job.status, deadlinePassed }} />
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="font-semibold text-slate-900 dark:text-slate-100">{job.company.name}</p>
            {job.company.isVerified && (
              <span className="mt-1 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400">
                ✓ Verified
              </span>
            )}
            <Link
              href={`/companies/${job.company.slug}`}
              className="mt-3 block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              View company profile →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

