"use client";

import Link from "next/link";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/providers";
import { formatSalary } from "@/lib/salary";

type SavedItem = {
  id: string;
  jobId: string;
  savedAt: string;
  job: {
    slug: string;
    title: string;
    status: string;
    location: string | null;
    locationType: string;
    type: string;
    salaryMinCents: number | null;
    salaryMaxCents: number | null;
    salaryPeriod: string;
    company: { name: string; slug: string; isVerified: boolean };
  };
};

export function SavedJobsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["saved-jobs"],
    queryFn: () => axios.get<{ items: SavedItem[] }>("/api/saved-jobs").then((r) => r.data),
  });

  const unsave = useMutation({
    mutationFn: (jobId: string) => axios.delete(`/api/saved-jobs/${jobId}`),
    onSuccess: () => {
      toast("Removed from saved jobs", "success");
      queryClient.invalidateQueries({ queryKey: ["saved-jobs"] });
    },
  });

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;

  const items = data?.items ?? [];

  return (
    <div className="flex flex-col gap-3">
      {items.map((s) => (
        <div
          key={s.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-5"
        >
          <div>
            <Link href={`/jobs/${s.job.slug}`} className="font-semibold text-slate-900 hover:underline">
              {s.job.title}
            </Link>
            <p className="mt-1 text-sm text-slate-500">
              {s.job.company.name}
              {s.job.company.isVerified && <span className="ml-1 text-emerald-600">✓</span>}
              {" · "}
              {[s.job.location, s.job.locationType, s.job.type].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">
              {formatSalary(s.job.salaryMinCents, s.job.salaryMaxCents, s.job.salaryPeriod as never)}
            </span>
            {s.job.status === "PUBLISHED" && (
              <Link
                href={`/jobs/${s.job.slug}`}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
              >
                Apply
              </Link>
            )}
            <button
              onClick={() => unsave.mutate(s.jobId)}
              disabled={unsave.isPending}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
            >
              Unsave
            </button>
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-600">No saved jobs yet.</p>
          <Link href="/jobs" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline">
            Browse jobs
          </Link>
        </div>
      )}
    </div>
  );
}
