"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import axios from "axios";

type Role = "CANDIDATE" | "EMPLOYER";

export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");

  const [role, setRole] = useState<Role>("CANDIDATE");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await axios.post("/api/auth/register", {
        name,
        email,
        password,
        role,
        ...(role === "EMPLOYER" ? { companyName } : {}),
      });
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        setError("Account created — please sign in manually.");
        router.push("/signin");
        return;
      }
      router.push(callbackUrl ?? (role === "EMPLOYER" ? "/employer" : "/account/profile"));
      router.refresh();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { error?: string; issues?: Record<string, string[]> };
        setError(data?.issues ? Object.values(data.issues).flat()[0] : data?.error ?? "Registration failed");
      } else {
        setError("Registration failed");
      }
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "rounded-md border border-slate-300 px-3 py-2 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:focus:border-slate-400";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Create your account</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Join as a candidate or an employer</p>

      {/* Role toggle */}
      <div className="mt-6 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        {(["CANDIDATE", "EMPLOYER"] as Role[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`rounded-md py-2 text-sm font-medium transition ${
              role === r
                ? "bg-white text-slate-900 shadow dark:bg-slate-950 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {r === "CANDIDATE" ? "Candidate" : "Employer"}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Full name</span>
          <input
            required
            minLength={1}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Jane Doe"
          />
        </label>

        {role === "EMPLOYER" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Company name</span>
            <input
              required
              minLength={2}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputClass}
              placeholder="Acme Inc."
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@example.com"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="At least 8 characters"
          />
        </label>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          {loading ? "Creating account…" : role === "EMPLOYER" ? "Create employer account" : "Create candidate account"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{" "}
        <Link href="/signin" className="font-medium text-slate-900 hover:underline dark:text-slate-100">
          Sign in
        </Link>
      </p>
    </div>
  );
}
