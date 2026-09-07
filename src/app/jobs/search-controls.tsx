"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useDebouncedCallback } from "./use-debounced-callback";

const selectClass =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none";

export function JobSearchControls() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const debouncedSetQ = useDebouncedCallback((value: string) => {
    update({ q: value });
  }, 300);

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    params.delete("page"); // any filter change resets pagination
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // keep the input in sync when the URL changes externally (back/forward)
  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("q")]);

  const sel = (key: string) => ({
    value: searchParams.get(key) ?? "",
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => update({ [key]: e.target.value || null }),
  });

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <input
        defaultValue={q}
        onChange={(e) => {
          setQ(e.target.value);
          debouncedSetQ(e.target.value);
        }}
        placeholder="Search title, skills, description…"
        className="min-w-64 flex-1 rounded-md border border-slate-300 px-4 py-2 text-sm focus:border-slate-900 focus:outline-none"
      />

      <select {...sel("locationType")} className={selectClass} aria-label="Location type">
        <option value="">Any location</option>
        <option value="REMOTE">Remote</option>
        <option value="HYBRID">Hybrid</option>
        <option value="ONSITE">On-site</option>
      </select>

      <select {...sel("type")} className={selectClass} aria-label="Job type">
        <option value="">Any type</option>
        <option value="FULL_TIME">Full-time</option>
        <option value="PART_TIME">Part-time</option>
        <option value="CONTRACT">Contract</option>
        <option value="INTERNSHIP">Internship</option>
        <option value="TEMPORARY">Temporary</option>
      </select>

      <select {...sel("experienceLevel")} className={selectClass} aria-label="Experience level">
        <option value="">Any level</option>
        <option value="ENTRY">Entry</option>
        <option value="MID">Mid</option>
        <option value="SENIOR">Senior</option>
        <option value="LEAD">Lead</option>
      </select>

      <select {...sel("category")} className={selectClass} aria-label="Category">
        <option value="">Any category</option>
        <option value="ENGINEERING">Engineering</option>
        <option value="DESIGN">Design</option>
        <option value="PRODUCT">Product</option>
        <option value="MARKETING">Marketing</option>
        <option value="SALES">Sales</option>
        <option value="DATA">Data</option>
        <option value="OPERATIONS">Operations</option>
        <option value="FINANCE">Finance</option>
        <option value="HR">HR</option>
        <option value="OTHER">Other</option>
      </select>

      <select {...sel("postedWithin")} className={selectClass} aria-label="Posted within">
        <option value="">Any time</option>
        <option value="24h">Last 24 hours</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
      </select>

      <select {...sel("sort")} className={selectClass} aria-label="Sort">
        <option value="">Sort: newest</option>
        <option value="relevant">Sort: relevance</option>
        <option value="salary_desc">Sort: salary</option>
      </select>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={searchParams.get("remote") === "true"}
          onChange={(e) => update({ remote: e.target.checked ? "true" : null })}
        />
        Remote only
      </label>
    </div>
  );
}
