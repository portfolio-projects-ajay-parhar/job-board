"use client";

import { useEffect, useState, FormEvent } from "react";
import axios from "axios";
import { useToast } from "@/components/providers";

type Profile = {
  fullName: string;
  headline: string | null;
  location: string | null;
  phone: string | null;
  bio: string | null;
  skills: string[];
  portfolioUrl: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  yearsOfExperience: number | null;
};

const label = "flex flex-col gap-1 text-sm";
const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none";

export function ProfileEditor() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skillsText, setSkillsText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get<Profile>("/api/profile").then(({ data }) => {
      setProfile(data);
      setSkillsText(data.skills.join(", "));
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      await axios.patch("/api/profile", {
        ...profile,
        skills: skillsText.split(",").map((s) => s.trim()).filter(Boolean),
        yearsOfExperience: profile.yearsOfExperience ?? null,
      });
      toast("Profile saved", "success");
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string })?.error ?? "Save failed"
        : "Save failed";
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return <p className="text-sm text-slate-500">Loading…</p>;

  const set = (patch: Partial<Profile>) => setProfile((p) => ({ ...(p as Profile), ...patch }));

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6">
      <div className="grid grid-cols-2 gap-4">
        <label className={label}>
          <span className="font-medium text-slate-700">Full name</span>
          <input required value={profile.fullName} onChange={(e) => set({ fullName: e.target.value })} className={inputClass} />
        </label>
        <label className={label}>
          <span className="font-medium text-slate-700">Headline</span>
          <input value={profile.headline ?? ""} onChange={(e) => set({ headline: e.target.value })} className={inputClass} placeholder="Senior Frontend Engineer" />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <label className={label}>
          <span className="font-medium text-slate-700">Location</span>
          <input value={profile.location ?? ""} onChange={(e) => set({ location: e.target.value })} className={inputClass} />
        </label>
        <label className={label}>
          <span className="font-medium text-slate-700">Phone</span>
          <input value={profile.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} className={inputClass} />
        </label>
        <label className={label}>
          <span className="font-medium text-slate-700">Years of experience</span>
          <input
            type="number"
            min={0}
            max={60}
            value={profile.yearsOfExperience ?? ""}
            onChange={(e) => set({ yearsOfExperience: e.target.value ? Number(e.target.value) : null })}
            className={inputClass}
          />
        </label>
      </div>

      <label className={label}>
        <span className="font-medium text-slate-700">Skills (comma-separated, max 20)</span>
        <input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} className={inputClass} placeholder="React, TypeScript, Node.js" />
      </label>

      <div className="grid grid-cols-3 gap-4">
        <label className={label}>
          <span className="font-medium text-slate-700">Portfolio URL</span>
          <input type="url" value={profile.portfolioUrl ?? ""} onChange={(e) => set({ portfolioUrl: e.target.value })} className={inputClass} placeholder="https://…" />
        </label>
        <label className={label}>
          <span className="font-medium text-slate-700">GitHub</span>
          <input type="url" value={profile.githubUrl ?? ""} onChange={(e) => set({ githubUrl: e.target.value })} className={inputClass} placeholder="https://github.com/…" />
        </label>
        <label className={label}>
          <span className="font-medium text-slate-700">LinkedIn</span>
          <input type="url" value={profile.linkedinUrl ?? ""} onChange={(e) => set({ linkedinUrl: e.target.value })} className={inputClass} placeholder="https://linkedin.com/in/…" />
        </label>
      </div>

      <label className={label}>
        <span className="font-medium text-slate-700">Bio</span>
        <textarea rows={4} value={profile.bio ?? ""} onChange={(e) => set({ bio: e.target.value })} className={inputClass} />
      </label>

      <button
        type="submit"
        disabled={saving}
        className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
