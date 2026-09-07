import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { JobModerationButtons } from "./job-buttons";

export default async function AdminJobsPage() {
  const jobs = await prisma.job.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { name: true } },
      _count: { select: { applications: true } },
    },
    take: 50,
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Views</th>
            <th className="px-4 py-3">Apps</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-3">
                <Link href={`/jobs/${j.slug}`} className="font-medium text-slate-900 hover:underline">
                  {j.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-slate-600">{j.company.name}</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{j.status}</span>
              </td>
              <td className="px-4 py-3 text-slate-600">{j.viewCount}</td>
              <td className="px-4 py-3 text-slate-600">{j._count.applications}</td>
              <td className="px-4 py-3">
                <JobModerationButtons id={j.id} featured={j.featured} status={j.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
