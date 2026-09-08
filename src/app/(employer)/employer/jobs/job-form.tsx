"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useToast } from "@/components/providers";
import { parseSalaryToCents } from "@/lib/salary";

type Job = {
  id?: string;
  title: string;
  description: string;
  responsibilities: string | null;
  requirements: string | null;
  benefits: string | null;
  type: string;
  locationType: string;
  location: string | null;
  country: string | null;
  category: string;
  experienceLevel: string;
  salaryMinCents: number | null;
  salaryMaxCents: number | null;
  salaryPeriod: string;
  applicationDeadline: string | null;
};

const TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "TEMPORARY"];
const LOCATION_TYPES = ["ONSITE", "REMOTE", "HYBRID"];
const CATEGORIES = ["ENGINEERING", "DESIGN", "PRODUCT", "MARKETING", "SALES", "DATA", "OPERATIONS", "FINANCE", "HR", "OTHER"];
const LEVELS = ["ENTRY", "MID", "SENIOR", "LEAD"];
const PERIODS = ["YEAR", "MONTH", "WEEK", "DAY", "HOUR"];

const label = "flex flex-col gap-1 text-sm";
const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:focus:border-slate-400";

const emptyJob: Job = {
  title: "",
  description: "",
  responsibilities: null,
  requirements: null,
  benefits: null,
  type: "FULL_TIME",
  locationType: "REMOTE",
  location: null,
  country: "US",
  category: "ENGINEERING",
  experienceLevel: "MID",
  salaryMinCents: null,
  salaryMaxCents: null,
  salaryPeriod: "YEAR",
  applicationDeadline: null,
};

export function JobForm({ jobId }: { jobId?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [job, setJob] = useState<Job>(emptyJob);
  const [minDollars, setMinDollars] = useState("");
  const [maxDollars, setMaxDollars] = useState("");
  const [deadline, setDeadline] = useState("");
  const [publish, setPublish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!jobId);

  useEffect(() => {
    if (!jobId) return;
    axios.get<Job>(`/api/employer/jobs/${jobId}`).then(({ data }) => {
      setJob(data);
      if (data.salaryMinCents) setMinDollars(String(data.salaryMinCents / 100));
      if (data.salaryMaxCents) setMaxDollars(String(data.salaryMaxCents / 100));
      if (data.applicationDeadline) setDeadline(data.applicationDeadline.slice(0, 10));
      setLoading(false);
    });
  }, [jobId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    let salaryMinCents: number | undefined;
    let salaryMaxCents: number | undefined;
    try {
      salaryMinCents = minDollars ? parseSalaryToCents(minDollars) : undefined;
      salaryMaxCents = maxDollars ? parseSalaryToCents(maxDollars) : undefined;
      if (salaryMinCents && salaryMaxCents && salaryMinCents > salaryMaxCents) {
        throw new Error("Minimum salary must be ≤ maximum salary");
      }
    } catch (err) {
      setError((err as Error).message);
      return;
    }

    const payload = {
      ...job,
      salaryMinCents,
      salaryMaxCents,
      applicationDeadline: deadline || null,
      publish,
    };

    try {
      if (jobId) {
        await axios.patch(`/api/employer/jobs/${jobId}`, payload);
        toast("Job updated", "success");
      } else {
        await axios.post("/api/employer/jobs", payload);
        toast(publish ? "Job published" : "Draft saved", "success");
      }
      router.push("/employer/jobs");
      router.refresh();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { error?: string; issues?: Record<string, string[]> };
        setError(data?.issues ? Object.values(data.issues).flat()[0] : data?.error ?? "Save failed");
      } else {
        setError("Save failed");
      }
    }
  }

  if (loading) return <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>;

  const set = (patch: Partial<Job>) => setJob((j) => ({ ...j, ...patch }));

  return (
    <form onSubmit={onSubmit} className="flex max-w-3xl flex-col gap-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <label className={label}>
        <span className="font-medium text-slate-700 dark:text-slate-300">Job title</span>
        <input required minLength={3} maxLength={120} value={job.title} onChange={(e) => set({ title: e.target.value })} className={inputClass} />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={label}>
          <span className="font-medium text-slate-700 dark:text-slate-300">Type</span>
          <select value={job.type} onChange={(e) => set({ type: e.target.value })} className={inputClass}>
            {TYPES.map((t) => <option key={t}>{t.replace("_", "-")}</option>)}
          </select>
        </label>
        <label className={label}>
          <span className="font-medium text-slate-700 dark:text-slate-300">Location type</span>
          <select value={job.locationType} onChange={(e) => set({ locationType: e.target.value })} className={inputClass}>
            {LOCATION_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={label}>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Location {job.locationType !== "REMOTE" && <span className="text-red-500">*</span>}
          </span>
          <input value={job.location ?? ""} onChange={(e) => set({ location: e.target.value })} className={inputClass} placeholder="San Francisco, CA" />
        </label>
        <label className={label}>
          <span className="font-medium text-slate-700 dark:text-slate-300">Country</span>
          <input value={job.country ?? ""} onChange={(e) => set({ country: e.target.value })} className={inputClass} />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className={label}>
          <span className="font-medium text-slate-700 dark:text-slate-300">Category</span>
          <select value={job.category} onChange={(e) => set({ category: e.target.value })} className={inputClass}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className={label}>
          <span className="font-medium text-slate-700 dark:text-slate-300">Experience level</span>
          <select value={job.experienceLevel} onChange={(e) => set({ experienceLevel: e.target.value })} className={inputClass}>
            {LEVELS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </label>
        <label className={label}>
          <span className="font-medium text-slate-700 dark:text-slate-300">Salary period</span>
          <select value={job.salaryPeriod} onChange={(e) => set({ salaryPeriod: e.target.value })} className={inputClass}>
            {PERIODS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className={label}>
          <span className="font-medium text-slate-700 dark:text-slate-300">Min salary (USD)</span>
          <input value={minDollars} onChange={(e) => setMinDollars(e.target.value)} className={inputClass} placeholder="120000" inputMode="decimal" />
        </label>
        <label className={label}>
          <span className="font-medium text-slate-700 dark:text-slate-300">Max salary (USD)</span>
          <input value={maxDollars} onChange={(e) => setMaxDollars(e.target.value)} className={inputClass} placeholder="160000" inputMode="decimal" />
        </label>
        <label className={label}>
          <span className="font-medium text-slate-700 dark:text-slate-300">Application deadline</span>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputClass} />
        </label>
      </div>

      <label className={label}>
        <span className="font-medium text-slate-700 dark:text-slate-300">Description (HTML, sanitized on save)</span>
        <textarea required rows={6} value={job.description} onChange={(e) => set({ description: e.target.value })} className={`${inputClass} font-mono`} placeholder="<p>Describe the role…</p>" />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className={label}>
          <span className="font-medium text-slate-700 dark:text-slate-300">Responsibilities</span>
          <textarea rows={4} value={job.responsibilities ?? ""} onChange={(e) => set({ responsibilities: e.target.value })} className={inputClass} />
        </label>
        <label className={label}>
          <span className="font-medium text-slate-700 dark:text-slate-300">Requirements</span>
          <textarea rows={4} value={job.requirements ?? ""} onChange={(e) => set({ requirements: e.target.value })} className={inputClass} />
        </label>
        <label className={label}>
          <span className="font-medium text-slate-700 dark:text-slate-300">Benefits</span>
          <textarea rows={4} value={job.benefits ?? ""} onChange={(e) => set({ benefits: e.target.value })} className={inputClass} />
        </label>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">{error}</p>}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {!jobId && (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
            Publish immediately (otherwise saved as draft)
          </label>
        )}
        <div className="flex gap-2">
          <Link href="/employer/jobs" className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            Cancel
          </Link>
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300">
            {jobId ? "Save changes" : publish ? "Publish job" : "Save draft"}
          </button>
        </div>
      </div>
    </form>
  );
}
