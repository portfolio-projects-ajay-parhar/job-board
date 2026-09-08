import { prisma } from "@/lib/prisma";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { applications: true } },
      company: { select: { _count: { select: { jobs: true } } } },
    },
    take: 100,
  });

  const roleBadge = (role: string) =>
    ({
      ADMIN: "bg-red-100 text-red-700",
      EMPLOYER: "bg-blue-100 text-blue-700",
      CANDIDATE: "bg-slate-100 text-slate-600",
    })[role] ?? "bg-slate-100 text-slate-600";

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Joined</th>
            <th className="px-4 py-3">Activity</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-900 dark:text-slate-100">{u.name ?? "—"}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleBadge(u.role)}`}>{u.role}</span>
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{u.createdAt.toLocaleDateString("en-US")}</td>
              <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                {u.role === "EMPLOYER" ? `${u.company?._count.jobs ?? 0} job posts` : `${u._count.applications} applications`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
        Roles are managed at the database/seed level — changing roles from the UI is destructive and out of MVP scope.
      </p>
    </div>
  );
}
