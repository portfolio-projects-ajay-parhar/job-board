import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EmployerDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const company = await prisma.company.findUnique({ where: { ownerUserId: session.user.id } });
  if (!company) return null;

  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [activeJobs, totalJobs, applicationsTotal, applicationsThisWeek, recent, jobs] = await Promise.all([
    prisma.job.count({ where: { companyId: company.id, status: "PUBLISHED" } }),
    prisma.job.count({ where: { companyId: company.id } }),
    prisma.application.count({ where: { job: { companyId: company.id } } }),
    prisma.application.count({ where: { job: { companyId: company.id }, submittedAt: { gte: weekAgo } } }),
    prisma.application.findMany({
      where: { job: { companyId: company.id } },
      orderBy: { lastStatusAt: "desc" },
      take: 6,
      include: {
        job: { select: { title: true } },
        candidate: { select: { name: true } },
      },
    }),
    prisma.job.findMany({
      where: { companyId: company.id, status: { in: ["PUBLISHED", "CLOSED"] } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, title: true, status: true, _count: { select: { applications: true } } },
    }),
  ]);

  const kpis = [
    { label: "Active job posts", value: activeJobs },
    { label: "Total jobs", value: totalJobs },
    { label: "Total applications", value: applicationsTotal },
    { label: "New this week", value: applicationsThisWeek },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
        <Link
          href="/employer/jobs/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          + New job
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-3xl font-bold text-slate-900">{k.value}</p>
            <p className="mt-1 text-sm text-slate-500">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-bold text-slate-900">Per-job funnel</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white text-sm">
            <table className="w-full text-left">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Applications</th>
                  <th className="px-4 py-3">Pipeline</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/employer/jobs/${j.id}/applications`} className="font-medium text-slate-800 hover:underline">
                        {j.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{j._count.applications}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/employer/jobs/${j.id}/applications`}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        {j.status} → view pipeline
                      </Link>
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                      No active jobs —{" "}
                      <Link href="/employer/jobs/new" className="font-medium text-blue-600 hover:underline">
                        post your first job
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">Recent applications</h2>
          <div className="mt-3 flex flex-col gap-2">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
                <span>
                  <strong className="text-slate-800">{r.candidate.name ?? "Candidate"}</strong>
                  <span className="text-slate-500"> → {r.job.title}</span>
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {r.status}
                </span>
              </div>
            ))}
            {recent.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                No applications yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

