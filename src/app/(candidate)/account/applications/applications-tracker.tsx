"use client";

import { useState } from "react";
import Link from "next/link";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/providers";
import { canTransitionApplication } from "@/lib/application-status";

type TrackerApplication = {
  id: string;
  status: string;
  submittedAt: string;
  job: { id: string; title: string; slug: string; company: { name: string; slug: string } };
  resume: { fileName: string };
  events: { id: string; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string }[];
};

const GROUPS: { label: string; statuses: string[] }[] = [
  { label: "Active", statuses: ["SUBMITTED", "IN_REVIEW"] },
  { label: "Interviewing", statuses: ["INTERVIEW", "OFFER"] },
  { label: "Closed", statuses: ["HIRED", "REJECTED", "WITHDRAWN"] },
];

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED: "bg-slate-100 text-slate-600",
  IN_REVIEW: "bg-blue-100 text-blue-700",
  INTERVIEW: "bg-indigo-100 text-indigo-700",
  OFFER: "bg-emerald-100 text-emerald-700",
  HIRED: "bg-emerald-600 text-white",
  REJECTED: "bg-red-100 text-red-600",
  WITHDRAWN: "bg-amber-100 text-amber-700",
};

const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days}d ago`;
};

export function ApplicationsTracker() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: () => axios.get<{ items: TrackerApplication[] }>("/api/applications").then((r) => r.data),
  });

  const withdraw = useMutation({
    mutationFn: (id: string) => axios.patch(`/api/applications/${id}/withdraw`),
    onSuccess: () => {
      toast("Application withdrawn", "success");
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (err) => {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? "Withdraw failed"
        : "Withdraw failed";
      toast(message, "error");
    },
  });

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <p className="text-slate-600">You haven&apos;t applied to any jobs yet.</p>
        <Link href="/jobs" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline">
          Browse jobs
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {GROUPS.map((group) => {
        const apps = items.filter((a) => group.statuses.includes(a.status));
        if (apps.length === 0) return null;
        return (
          <section key={group.label}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {group.label} ({apps.length})
            </h2>
            <div className="mt-3 flex flex-col gap-3">
              {apps.map((a) => {
                const canWithdraw = canTransitionApplication(a.status, "WITHDRAWN");
                const open = expanded === a.id;
                return (
                  <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link href={`/jobs/${a.job.slug}`} className="font-semibold text-slate-900 hover:underline">
                          {a.job.title}
                        </Link>
                        <p className="mt-1 text-sm text-slate-500">
                          {a.job.company.name} · applied {ago(a.submittedAt)} · resume: {a.resume.fileName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[a.status]}`}>
                          {a.status}
                        </span>
                        <button
                          onClick={() => setExpanded(open ? null : a.id)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-100"
                        >
                          {open ? "Hide timeline" : "Timeline"}
                        </button>
                        {canWithdraw && (
                          <button
                            onClick={() => {
                              if (confirm(`Withdraw application to "${a.job.title}"?`)) withdraw.mutate(a.id);
                            }}
                            disabled={withdraw.isPending}
                            className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                          >
                            Withdraw
                          </button>
                        )}
                      </div>
                    </div>

                    {open && (
                      <ol className="mt-4 border-l-2 border-slate-200 pl-4">
                        {a.events.map((e) => (
                          <li key={e.id} className="relative pb-4 last:pb-0">
                            <span className="absolute -left-[22px] top-1 h-3 w-3 rounded-full bg-slate-900" />
                            <p className="text-sm font-medium text-slate-800">
                              {e.fromStatus ? `${e.fromStatus} → ${e.toStatus}` : e.toStatus}
                            </p>
                            {e.note && <p className="text-xs text-slate-500">{e.note}</p>}
                            <p className="text-xs text-slate-400">{new Date(e.createdAt).toLocaleString("en-US")}</p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
