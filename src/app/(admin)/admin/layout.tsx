import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Server-side role enforcement — only ADMINs pass.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") redirect("/");

  const nav = [
    ["/admin", "Overview"],
    ["/admin/companies", "Companies"],
    ["/admin/jobs", "Jobs"],
    ["/admin/users", "Users"],
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Admin panel</h1>
        <nav className="flex gap-2 text-sm">
          {nav.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

