import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Placeholder — full profile editor + resume manager arrive in Phase 5/10.
export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Your profile</h1>
      <p className="mt-2 text-slate-600">
        Signed in as {session.user.name} ({session.user.email}).
      </p>
      <p className="mt-4 text-sm text-slate-500">Profile editor and resume manager coming in Phase 5/10.</p>
    </div>
  );
}
