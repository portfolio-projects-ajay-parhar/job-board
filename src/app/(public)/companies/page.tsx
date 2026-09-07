import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Companies" };

const PAGE_SIZE = 12;

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const where = q ? { name: { contains: q, mode: "insensitive" as const } } : {};

  const [total, companies] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      select: {
        name: true,
        slug: true,
        location: true,
        industry: true,
        isVerified: true,
        _count: { select: { jobs: { where: { status: "PUBLISHED" } } } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-slate-900">Companies</h1>
      <p className="mt-1 text-slate-500">{total} companies hiring on JobBoard</p>

      <form className="mt-6 flex gap-2" action="/companies">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search companies…"
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
        />
        <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
          Search
        </button>
      </form>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => (
          <Link
            key={c.slug}
            href={`/companies/${c.slug}`}
            className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-400"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">{c.name}</span>
              {c.isVerified && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  Verified
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {[c.industry, c.location].filter(Boolean).join(" · ") || "—"}
            </p>
            <p className="mt-3 text-sm font-medium text-slate-700">
              {c._count.jobs} open role{c._count.jobs === 1 ? "" : "s"}
            </p>
          </Link>
        ))}
        {companies.length === 0 && (
          <p className="col-span-full py-10 text-center text-slate-500">No companies found.</p>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-8 flex justify-center gap-2 text-sm">
          {Array.from({ length: pages }, (_, i) => (
            <Link
              key={i}
              href={`/companies?page=${i + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-md px-3 py-1.5 ${
                i + 1 === page ? "bg-slate-900 text-white" : "border border-slate-300 bg-white hover:bg-slate-100"
              }`}
            >
              {i + 1}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
