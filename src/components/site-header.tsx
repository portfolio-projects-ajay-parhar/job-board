import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";

const link = "hover:text-slate-900 text-slate-600";

export async function SiteHeader() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          JobBoard
        </Link>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/jobs" className={link}>
            Jobs
          </Link>
          <Link href="/companies" className={link}>
            Companies
          </Link>
          {role === "CANDIDATE" && (
            <>
              <Link href="/account/profile" className={link}>
                Profile
              </Link>
              <Link href="/account/applications" className={link}>
                Applications
              </Link>
              <Link href="/account/saved" className={link}>
                Saved
              </Link>
            </>
          )}
          {role === "EMPLOYER" && (
            <>
              <Link href="/employer" className={link}>
                Dashboard
              </Link>
              <Link href="/employer/company" className={link}>
                Company
              </Link>
              <Link href="/employer/jobs" className={link}>
                Job posts
              </Link>
            </>
          )}
          {role === "ADMIN" && (
            <Link href="/admin" className={link}>
              Admin
            </Link>
          )}
          {session ? (
            <span className="flex items-center gap-3">
              <span className="text-slate-700">{session.user?.name ?? session.user?.email}</span>
              <SignOutButton />
            </span>
          ) : (
            <span className="flex items-center gap-3">
              <Link href="/signin" className={link}>
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-700"
              >
                Sign up
              </Link>
            </span>
          )}
        </div>
      </nav>
    </header>
  );
}
