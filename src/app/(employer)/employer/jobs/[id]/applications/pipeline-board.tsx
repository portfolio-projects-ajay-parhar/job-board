"use client";

import { useState } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/providers";
import { employerLegalNext } from "@/lib/application-status";

type PipelineApplication = {
  id: string;
  status: string;
  coverLetter: string | null;
  submittedAt: string;
  lastStatusAt: string;
  candidate: { id: string; name: string | null; email: string; headline: string | null; skills: string[] };
  resume: { id: string; fileName: string; mimeType: string } | null;
};

const COLUMNS = ["SUBMITTED", "IN_REVIEW", "INTERVIEW", "OFFER", "HIRED", "REJECTED", "WITHDRAWN"];

const COLUMN_STYLES: Record<string, string> = {
  SUBMITTED: "border-slate-300",
  IN_REVIEW: "border-blue-300",
  INTERVIEW: "border-indigo-300",
  OFFER: "border-emerald-300",
  HIRED: "border-emerald-500",
  REJECTED: "border-red-300",
  WITHDRAWN: "border-amber-300",
};

export function PipelineBoard({ jobId }: { jobId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [detail, setDetail] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["pipeline", jobId],
    queryFn: () =>
      axios.get<{ items: PipelineApplication[] }>(`/api/employer/jobs/${jobId}/applications`).then((r) => r.data),
  });

  const move = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      axios.patch(`/api/employer/applications/${id}`, { status, note }),
    onSuccess: (_d, vars) => {
      toast(`Moved to ${vars.status} — candidate will be notified`, "success");
      queryClient.invalidateQueries({ queryKey: ["pipeline", jobId] });
    },
    onError: (err) => {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? "Status change failed"
        : "Status change failed";
      toast(message, "error");
    },
  });

  if (isLoading) return <p className="text-sm text-slate-500 dark:text-slate-400">Loading pipeline…</p>;
  const items = data?.items ?? [];

  return (
    <div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const apps = items.filter((a) => a.status === col);
          return (
            <div key={col} className={`w-72 shrink-0 rounded-xl border-t-4 bg-slate-100 p-3 dark:bg-slate-800/60 ${COLUMN_STYLES[col]}`}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {col} ({apps.length})
              </p>
              <div className="flex flex-col gap-2">
                {apps.map((a) => {
                  const legal = employerLegalNext(a.status);
                  const open = detail === a.id;
                  return (
                    <div key={a.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      <button onClick={() => setDetail(open ? null : a.id)} className="w-full text-left">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{a.candidate.name ?? a.candidate.email}</p>
                        {a.candidate.headline && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{a.candidate.headline}</p>}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {a.candidate.skills.slice(0, 3).map((s) => (
                            <span key={s} className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                              {s}
                            </span>
                          ))}
                        </div>
                      </button>

                      {open && (
                        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                          <p className="text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Cover letter</p>
                          <p className="mt-1 whitespace-pre-line text-xs text-slate-600 dark:text-slate-300">
                            {a.coverLetter ?? "— none —"}
                          </p>
                          <p className="mt-2 text-xs font-semibold uppercase text-slate-400 dark:text-slate-500">Resume</p>
                          {a.resume ? (
                            <a
                              href={`/api/resumes/${a.resume.id}/download`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {a.resume.fileName} (signed download →)
                            </a>
                          ) : (
                            <p className="text-xs text-slate-500 dark:text-slate-400">—</p>
                          )}
                          {legal.length > 0 && (
                            <div className="mt-3 flex flex-col gap-2">
                              {legal.map((to) => (
                                <button
                                  key={to}
                                  disabled={move.isPending}
                                  onClick={() => {
                                    const note =
                                      to === "REJECTED" ? (prompt("Optional rejection note:") ?? undefined) : undefined;
                                    move.mutate({ id: a.id, status: to, note });
                                  }}
                                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                                    to === "REJECTED"
                                      ? "border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/50"
                                      : "bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
                                  }`}
                                >
                                  Move to {to}
                                </button>
                              ))}
                              <p className="text-[10px] text-slate-400 dark:text-slate-500">Candidate will be notified by email.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {apps.length === 0 && <p className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">Empty</p>}
              </div>
            </div>
          );
        })}
      </div>
      {items.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          No applications yet. Share the job link to start receiving applications.
        </div>
      )}
    </div>
  );
}
