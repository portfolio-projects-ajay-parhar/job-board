"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/providers";

type JobMeta = { id: string; slug: string; status: string; deadlinePassed: boolean };
type ResumeOption = { id: string; fileName: string; isPrimary: boolean };

export function JobActions({ job }: { job: JobMeta }) {
  const { data: session, status: sessionStatus } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [resumes, setResumes] = useState<ResumeOption[]>([]);
  const [resumeId, setResumeId] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [applied, setApplied] = useState<null | { status: string }>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const role = session?.user?.role;
  const isCandidate = role === "CANDIDATE";
  const notApplicable = role === "EMPLOYER" || role === "ADMIN";
  const isGuest = sessionStatus === "unauthenticated";
  const closed = job.status !== "PUBLISHED" || job.deadlinePassed;

  useEffect(() => {
    if (!isCandidate) return;
    axios.get("/api/resumes").then(({ data }) => {
      setResumes(data.items);
      setResumeId(data.items.find((r: ResumeOption) => r.isPrimary)?.id ?? data.items[0]?.id ?? "");
    });
    axios.get("/api/applications").then(({ data }) => {
      const mine = data.items.find((a: { job: { slug: string } }) => a.job.slug === job.slug);
      if (mine) setApplied({ status: mine.status });
    });
    axios.get("/api/saved-jobs").then(({ data }) => {
      setSaved(data.items.some((s: { jobId: string }) => s.jobId === job.id));
    });
  }, [isCandidate, job.slug, job.id]);

  async function onApply(e: FormEvent) {
    e.preventDefault();
    if (!resumeId) {
      toast("Upload a resume first (Profile → Resumes)", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await axios.post(`/api/jobs/${job.slug}/apply`, {
        resumeId,
        coverLetter: coverLetter || undefined,
      });
      setApplied({ status: res.data.status ?? "SUBMITTED" });
      setShowForm(false);
      toast("Application submitted!", "success");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? "Application failed"
        : "Application failed";
      toast(message, "error");
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setApplied({ status: "SUBMITTED" });
        setShowForm(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleSave() {
    setBusy(true);
    try {
      if (saved) {
        await axios.delete(`/api/saved-jobs/${job.id}`);
        setSaved(false);
        toast("Removed from saved jobs", "info");
      } else {
        await axios.put(`/api/saved-jobs/${job.id}`);
        setSaved(true);
        toast("Job saved", "success");
      }
    } catch {
      toast("Could not update saved jobs", "error");
    } finally {
      setBusy(false);
    }
  }

  if (sessionStatus === "loading") return null;
  if (notApplicable) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      {/* Save toggle (candidates, open jobs) */}
      {isCandidate && !closed && (
        <button
          onClick={toggleSave}
          disabled={busy}
          className={`mb-3 w-full rounded-md border px-4 py-2 text-sm font-medium ${
            saved
              ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400"
              : "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          {saved ? "★ Saved" : "☆ Save job"}
        </button>
      )}

      {/* Guest */}
      {isGuest && !closed && (
        <Link
          href={`/signin?callbackUrl=/jobs/${job.slug}`}
          className="block w-full rounded-md bg-slate-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-slate-700"
        >
          Sign in to apply
        </Link>
      )}

      {/* Closed / deadline passed */}
      {closed && (
        <p className="text-sm text-slate-500">
          {job.status !== "PUBLISHED"
            ? "This job is not open for applications."
            : "The application deadline has passed."}
        </p>
      )}

      {/* Already applied */}
      {isCandidate && !closed && applied && (
        <div className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          ✓ Applied — current status: <strong>{applied.status}</strong>
        </div>
      )}

      {/* Apply CTA + form */}
      {isCandidate && !closed && !applied && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Apply now
        </button>
      )}

      {isCandidate && !closed && !applied && showForm && (
        <form onSubmit={onApply} className="flex flex-col gap-3">
          <label className="text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Resume</span>
            <select
              value={resumeId}
              onChange={(e) => setResumeId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            >
              {resumes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fileName}
                  {r.isPrimary ? " ★" : ""}
                </option>
              ))}
            </select>
            {resumes.length === 0 && (
              <span className="mt-1 block text-xs text-red-500">
                No resumes yet —{" "}
                <Link href="/account/profile" className="underline">
                  upload one
                </Link>
              </span>
            )}
          </label>
          <label className="text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Cover letter (optional)</span>
            <textarea
              rows={4}
              maxLength={5000}
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              placeholder="Why are you a great fit?"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit application"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
