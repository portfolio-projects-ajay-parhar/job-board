"use client";

import { useRef } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/providers";

type ResumeRow = {
  id: string;
  fileName: string;
  sizeBytes: number;
  isPrimary: boolean;
  uploadedAt: string;
  appliedCount: number;
};

const fmtSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

export function ResumeManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const makePrimaryRef = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ["resumes"],
    queryFn: () => axios.get<{ items: ResumeRow[] }>("/api/resumes").then((r) => r.data),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["resumes"] });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      form.append("makePrimary", String(makePrimaryRef.current));
      return axios.post("/api/resumes", form);
    },
    onSuccess: () => {
      toast("Resume uploaded", "success");
      invalidate();
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (err) => {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? "Upload failed"
        : "Upload failed";
      toast(message, "error");
    },
  });

  const setPrimary = useMutation({
    mutationFn: (id: string) => axios.patch(`/api/resumes/${id}`),
    onSuccess: () => {
      toast("Primary resume updated", "success");
      invalidate();
    },
    onError: () => toast("Could not set primary", "error"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/resumes/${id}`),
    onSuccess: () => {
      toast("Resume deleted", "success");
      invalidate();
    },
    onError: (err) => {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? "Delete failed"
        : "Delete failed";
      toast(message, "error");
    },
  });

  const resumes = data?.items ?? [];

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-semibold text-slate-900">Resumes</h2>

      <div className="flex flex-col gap-2 text-sm">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])}
          className="text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-white"
        />
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            onChange={(e) => {
              makePrimaryRef.current = e.target.checked;
            }}
          />
          Set as primary on upload (PDF/DOCX, ≤ 5 MB)
        </label>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      <ul className="flex flex-col gap-2">
        {resumes.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">
                {r.isPrimary && <span className="mr-1 text-amber-500">★</span>}
                {r.fileName}
              </p>
              <p className="text-xs text-slate-500">
                {fmtSize(r.sizeBytes)} ·{" "}
                {r.appliedCount > 0 ? `used by ${r.appliedCount} application${r.appliedCount === 1 ? "" : "s"}` : "unused"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              {!r.isPrimary && (
                <button
                  onClick={() => setPrimary.mutate(r.id)}
                  disabled={setPrimary.isPending}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                >
                  Primary
                </button>
              )}
              <a
                href={`/api/resumes/${r.id}/download`}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
              >
                Open
              </a>
              <button
                onClick={() => {
                  if (confirm(`Delete "${r.fileName}"?`)) remove.mutate(r.id);
                }}
                disabled={remove.isPending}
                className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {!isLoading && resumes.length === 0 && (
          <li className="py-4 text-center text-sm text-slate-500">No resumes yet — upload your first.</li>
        )}
      </ul>
    </div>
  );
}
