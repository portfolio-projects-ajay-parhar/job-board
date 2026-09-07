import { prisma } from "@/lib/prisma";

export default async function AdminPage() {
  const [usersByRole, companyTotal, companyVerified, jobsByStatus, appsByStatus] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { role: true } }),
    prisma.company.count(),
    prisma.company.count({ where: { isVerified: true } }),
    prisma.job.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.application.groupBy({ by: ["status"], _count: { status: true } }),
  ]);

  const series = await prisma.$queryRaw<{ day: Date; signups: bigint; applications: bigint }[]>`
    SELECT d::date AS day,
      (SELECT count(*) FROM "User" u WHERE u."createdAt"::date = d::date) AS signups,
      (SELECT count(*) FROM "Application" a WHERE a."submittedAt"::date = d::date) AS applications
    FROM generate_series(now()::date - interval '29 days', now()::date, interval '1 day') d
    ORDER BY d`;

  const roleMap = Object.fromEntries(usersByRole.map((r) => [r.role, r._count.role]));
  const jobMap = Object.fromEntries(jobsByStatus.map((r) => [r.status, r._count.status]));
  const appMap = Object.fromEntries(appsByStatus.map((r) => [r.status, r._count.status]));
  const maxSeries = Math.max(1, ...series.map((s) => Number(s.signups) + Number(s.applications)));

  const kpis = [
    { label: "Users", value: `${(roleMap.CANDIDATE ?? 0) + (roleMap.EMPLOYER ?? 0) + (roleMap.ADMIN ?? 0)}`, detail: `${roleMap.CANDIDATE ?? 0} candidates · ${roleMap.EMPLOYER ?? 0} employers · ${roleMap.ADMIN ?? 0} admins` },
    { label: "Companies", value: companyTotal, detail: `${companyVerified} verified` },
    { label: "Jobs", value: Object.values(jobMap).reduce((a, b) => a + b, 0), detail: `${jobMap.PUBLISHED ?? 0} published · ${jobMap.DRAFT ?? 0} drafts · ${jobMap.CLOSED ?? 0} closed` },
    { label: "Applications", value: Object.values(appMap).reduce((a, b) => a + b, 0), detail: `${appMap.SUBMITTED ?? 0} new · ${appMap.HIRED ?? 0} hired · ${appMap.REJECTED ?? 0} rejected` },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-3xl font-bold text-slate-900">{k.value}</p>
            <p className="mt-1 text-sm font-medium text-slate-600">{k.label}</p>
            <p className="mt-1 text-xs text-slate-400">{k.detail}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-900">Last 30 days</h2>
        <p className="text-sm text-slate-500">Signups (dark) and applications (emerald) per day</p>
        <div className="mt-4 flex h-32 items-end gap-1">
          {series.map((s) => {
            const total = Number(s.signups) + Number(s.applications);
            return (
              <div key={s.day.toISOString()} className="flex flex-1 flex-col justify-end gap-0.5" title={`${s.day.toISOString().slice(0, 10)}: ${s.signups} signups, ${s.applications} applications`}>
                <div className="rounded-t bg-emerald-500" style={{ height: `${(Number(s.applications) / maxSeries) * 100}%` }} />
                <div className="bg-slate-800" style={{ height: `${(Number(s.signups) / maxSeries) * 100}%` }} />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

