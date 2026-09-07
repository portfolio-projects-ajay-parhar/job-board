"use client";

import { useEffect, useState, FormEvent } from "react";
import axios from "axios";
import { useToast } from "@/components/providers";

type Company = {
  name: string;
  website: string | null;
  description: string | null;
  location: string | null;
  industry: string | null;
  size: string;
  foundedYear: number | null;
  logoUrl: string | null;
};

const SIZES = [
  ["STARTUP_1_10", "Startup (1–10)"],
  ["SMALL_11_50", "Small (11–50)"],
  ["MEDIUM_51_200", "Medium (51–200)"],
  ["LARGE_201_1000", "Large (201–1000)"],
  ["ENTERPRISE_1000_PLUS", "Enterprise (1000+)"],
] as const;

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none";

export function CompanyEditor() {
  const { toast } = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    axios.get<Company>("/api/employer/company").then((r) => setCompany(r.data));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!company) return;
    setSaving(true);
    try {
      let logoUrl = company.logoUrl ?? "";
      if (logoFile) {
        setUploading(true);
        const form = new FormData();
        form.append("file", logoFile);
        const res = await axios.post<{ key: string }>("/api/media", form);
        logoUrl = res.data.key; // store the key; resolve signed URL at render
        setUploading(false);
      }
      await axios.patch("/api/employer/company", { ...company, logoUrl });
      toast("Company profile saved", "success");
      setLogoFile(null);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? "Save failed"
        : "Save failed";
      toast(message, "error");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  if (!company) return <p className="text-sm text-slate-500">Loading…</p>;

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-xl font-bold text-slate-400">
          {company.logoUrl ? "IMG" : company.name.charAt(0)}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Logo (PNG/JPEG/WebP, ≤ 2 MB)</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-white"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Company name</span>
        <input
          required
          minLength={2}
          value={company.name}
          onChange={(e) => setCompany({ ...company, name: e.target.value })}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Website</span>
          <input
            type="url"
            value={company.website ?? ""}
            onChange={(e) => setCompany({ ...company, website: e.target.value })}
            className={inputClass}
            placeholder="https://…"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Location</span>
          <input
            value={company.location ?? ""}
            onChange={(e) => setCompany({ ...company, location: e.target.value })}
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Industry</span>
          <input
            value={company.industry ?? ""}
            onChange={(e) => setCompany({ ...company, industry: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Size</span>
          <select
            value={company.size}
            onChange={(e) => setCompany({ ...company, size: e.target.value })}
            className={inputClass}
          >
            {SIZES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Description</span>
        <textarea
          rows={4}
          value={company.description ?? ""}
          onChange={(e) => setCompany({ ...company, description: e.target.value })}
          className={inputClass}
        />
      </label>

      <button
        type="submit"
        disabled={saving || uploading}
        className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : uploading ? "Uploading logo…" : "Save profile"}
      </button>
    </form>
  );
}
