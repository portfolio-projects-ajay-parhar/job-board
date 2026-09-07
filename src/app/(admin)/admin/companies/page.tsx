import { prisma } from "@/lib/prisma";
import { VerifyButton } from "./verify-button";

export default async function AdminCompaniesPage() {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { email: true } },
      _count: { select: { jobs: true } },
    },
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Owner</th>
            <th className="px-4 py-3">Jobs</th>
            <th className="px-4 py-3">Verified</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
              <td className="px-4 py-3 text-slate-600">{c.owner.email}</td>
              <td className="px-4 py-3 text-slate-600">{c._count.jobs}</td>
              <td className="px-4 py-3">
                {c.isVerified ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Verified</span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">No</span>
                )}
              </td>
              <td className="px-4 py-3">
                <VerifyButton id={c.id} isVerified={c.isVerified} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
