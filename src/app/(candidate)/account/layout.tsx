import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Server-side role enforcement — hiding UI in the header is never the boundary.
export default async function CandidateAccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/signin?callbackUrl=/account/profile");
  if (session.user.role !== "CANDIDATE") redirect("/");
  return <div className="mx-auto max-w-4xl px-4 py-8">{children}</div>;
}
