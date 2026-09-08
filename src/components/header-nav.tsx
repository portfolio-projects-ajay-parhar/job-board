"use client";

import { useState } from "react";
import Link from "next/link";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";

type SessionInfo = { name: string | null; email: string | null; role?: string } | null;

const desktopLink =
  "rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100";
const mobileLink =
  "rounded-md px-2 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800";

function BurgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function HeaderNav({ session }: { session: SessionInfo }) {
  const [open, setOpen] = useState(false);
  const role = session?.role;
  const close = () => setOpen(false);

  const links: [string, string][] = [
    ["/jobs", "Jobs"],
    ["/companies", "Companies"],
  ];
  if (role === "CANDIDATE") {
    links.push(["/account/profile", "Profile"], ["/account/applications", "Applications"], ["/account/saved", "Saved"]);
  }
  if (role === "EMPLOYER") {
    links.push(["/employer", "Dashboard"], ["/employer/company", "Company"], ["/employer/jobs", "Job posts"]);
  }
  if (role === "ADMIN") {
    links.push(["/admin", "Admin"]);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" onClick={close} className="shrink-0 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
          JobBoard
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center md:flex">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className={desktopLink}>
              {label}
            </Link>
          ))}
          <ThemeToggle />
          {session ? (
            <div className="ml-2 flex max-w-[16rem] items-center gap-2 border-l border-slate-200 pl-3 dark:border-slate-700">
              <span className="truncate text-sm text-slate-700 dark:text-slate-200">{session.name ?? session.email}</span>
              <SignOutButton />
            </div>
          ) : (
            <div className="ml-2 flex items-center gap-2 border-l border-slate-200 pl-3 dark:border-slate-700">
              <Link href="/signin" className={desktopLink}>
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>

        {/* Mobile: theme toggle + hamburger */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            className="rounded-md p-2 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 md:hidden"
          >
            {open ? <CloseIcon /> : <BurgerIcon />}
          </button>
        </div>
      </nav>

      {/* Mobile panel */}
      {open && (
        <div id="mobile-nav" className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {links.map(([href, label]) => (
              <Link key={href} href={href} onClick={close} className={mobileLink}>
                {label}
              </Link>
            ))}
            {session ? (
              <div className="mt-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <p className="truncate px-2 pb-2 text-xs text-slate-400 dark:text-slate-500">{session.name ?? session.email}</p>
                <div className="px-2">
                  <SignOutButton />
                </div>
              </div>
            ) : (
              <div className="mt-2 flex gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <Link
                  href="/signin"
                  onClick={close}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  onClick={close}
                  className="flex-1 rounded-md bg-slate-900 px-3 py-2 text-center text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}