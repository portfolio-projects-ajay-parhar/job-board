import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Server-side role enforcement — only ADMINs pass.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") redirect("/");
  return <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>;
}
