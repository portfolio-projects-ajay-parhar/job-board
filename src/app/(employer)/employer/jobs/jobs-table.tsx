"use client";

import { useState } from "react";
import Link from "next/link";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/providers";
import { jobStatusActions } from "@/lib/job-status";
import { formatSalary } from "@/lib/salary";

type JobRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  viewCount: number;
  applicationCount: number;
  salaryMinCents: number | null;
  salaryMaxCents: number | null;
  salaryPeriod: string;
  createdAt: string;
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  PUBLISHED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400",
  CLOSED: "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400",
  ARCHIVED: "bg-red-100 text-red-600 dark:bg-red-400/10 dark:text-red-400",
};

const ACTION_LABELS: Record<string, string> = {
  PUBLISHED: "Publish",
  CLOSED: "Close",
  ARCHIVED: "Archive",
};

const FILTERS = ["ALL", "DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"];

export function JobsTable() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["employer-jobs"],
    queryFn: () => axios.get<{ items: JobRow[] }>("/api/employer/jobs").then((r) => r.data),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      axios.patch(`/api/employer/jobs/${id}/status`, { status }),
    onSuccess: () => {
      toast("Job status updated", "success");
      queryClient.invalidateQueries({ queryKey: ["employer-jobs"] });
    },
    onError: (err) => {
      const message =
        axios.isAxiosError(err)
          ? (err.response?.data as { error?: string })?.error ?? "Update failed"
          : "Update failed";
      toast(message, "error");
    },
  });

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;

  const jobs = (data?.items ?? []).filter((j) => filter === "ALL" || j.status === filter);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === f
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Salary</th>
              <th className="px-4 py-3">Views</th>
              <th className="px-4 py-3">Applicants</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/employer/jobs/${job.id}/edit`} className="font-medium text-slate-900 hover:underline dark:text-slate-100">
                    {job.title}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[job.status]}`}>
                    {job.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {formatSalary(job.salaryMinCents, job.salaryMaxCents, job.salaryPeriod as never)}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{job.viewCount}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{job.applicationCount}</td>
                <td className="flex flex-wrap gap-1 px-4 py-3">
                  {jobStatusActions(job.status).map((action) => (
                    <button
                      key={action}
                      disabled={statusMutation.isPending}
                      onClick={() => statusMutation.mutate({ id: job.id, status: action })}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {ACTION_LABELS[action] ?? action}
                    </button>
                  ))}
                  {job.status !== "ARCHIVED" && (
                    <Link
                      href={`/employer/jobs/${job.id}/edit`}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Edit
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                  No jobs in this view yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
