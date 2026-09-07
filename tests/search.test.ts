import { describe, it, expect } from "vitest";
import { buildJobSearch, toSearchResult, type JobSearchRow } from "@/lib/search";
import { toYearlyCents, toMonthlyCents } from "@/lib/salary";

describe("search builder — SQL composition", () => {
  it("q-only: FTS + trgm partial-match arm + relevant sort by default", () => {
    const { sql, args } = buildJobSearch({ q: "react", page: 1, pageSize: 20 });
    expect(sql).toContain("websearch_to_tsquery('english', $1)");
    expect(sql).toContain(`j."searchVector" @@ websearch_to_tsquery('english', $1)`);
    expect(sql).toContain(`j.title ILIKE '%' || $1 || '%'`);
    expect(sql).toContain("ORDER BY rank DESC");
    expect(args).toEqual(["react", 20, 0]);
  });

  it("empty q → plain listing, newest first", () => {
    const { sql, args } = buildJobSearch({ page: 1, pageSize: 20 });
    expect(sql).not.toContain("ts_rank");
    expect(sql).not.toContain("websearch_to_tsquery");
    expect(sql).toContain(`ORDER BY j."publishedAt" DESC`);
    expect(args).toEqual([20, 0]);
  });

  it("explicit sort=newest wins over q for ordering", () => {
    const { sql } = buildJobSearch({ q: "react", sort: "newest", page: 1, pageSize: 20 });
    expect(sql).toContain(`ORDER BY j."publishedAt" DESC`);
  });

  it("each optional filter contributes one parameterized clause", () => {
    const { sql, args } = buildJobSearch({
      type: "FULL_TIME",
      locationType: "REMOTE",
      experienceLevel: "SENIOR",
      category: "ENGINEERING",
      page: 1,
      pageSize: 20,
    });
    expect(sql).toContain(`$1::"JobType" IS NULL OR j."type" = $1::"JobType"`);
    expect(sql).toContain(`$2::"LocationType" IS NULL OR j."locationType" = $2::"LocationType"`);
    expect(sql).toContain(`$3::"ExperienceLevel" IS NULL OR j."experienceLevel" = $3::"ExperienceLevel"`);
    expect(sql).toContain(`$4::"Category" IS NULL OR j."category" = $4::"Category"`);
    expect(args.slice(0, 4)).toEqual(["FULL_TIME", "REMOTE", "SENIOR", "ENGINEERING"]);
  });

  it("all filters together compose in order", () => {
    const now = new Date("2026-01-10T00:00:00Z");
    const { sql, args } = buildJobSearch({
      q: "react",
      type: "FULL_TIME",
      locationType: "REMOTE",
      experienceLevel: "SENIOR",
      category: "ENGINEERING",
      minSalary: 800_000,
      maxSalary: 2_000_000,
      remote: true,
      postedWithin: "7d",
      sort: "salary_desc",
      page: 2,
      pageSize: 20,
      now,
    });
    expect(sql).toContain(`j."searchVector" @@ websearch_to_tsquery('english', $1)`);
    expect(sql).toContain(`$1::text = ''`);
    expect(sql).toContain(`j."locationType" = 'REMOTE'`); // remote shortcut (constant)
    expect(sql).toContain(`$6::int IS NULL OR j."salaryMonthlyCents" >= $6::int`);
    expect(sql).toContain(`$7::int IS NULL OR j."salaryMonthlyCents" <= $7::int`);
    expect(sql).toContain(`$8::timestamptz IS NULL OR j."publishedAt" >= $8::timestamptz`);
    expect(sql).toContain(`ORDER BY j."salaryMonthlyCents" DESC NULLS LAST`);
    expect(args[0]).toBe("react");
    expect(args[5]).toBe(800_000);
    expect(args[6]).toBe(2_000_000);
    expect(args[7]).toBe(new Date(now.getTime() - 168 * 3600_000).toISOString());
    expect(args).toHaveLength(10); // q + 4 enums + 2 salaries + cutoff + limit + offset
    expect(args[8]).toBe(20);
    expect(args[9]).toBe(20); // offset = (page2-1)*20
  });

  it("min salary only", () => {
    const { sql, args } = buildJobSearch({ minSalary: 500_000, page: 1, pageSize: 20 });
    expect(sql).toContain(`$1::int IS NULL OR j."salaryMonthlyCents" >= $1::int`);
    expect(sql).not.toContain("<= $1::int");
    expect(args[0]).toBe(500_000);
  });

  it("remote=true adds the REMOTE constant clause", () => {
    const { sql } = buildJobSearch({ remote: true, page: 1, pageSize: 20 });
    expect(sql).toContain(`j."locationType" = 'REMOTE'`);
  });

  it("pagination math: page 3 @ 20 → offset 40; caps pageSize at 50", () => {
    const { sql, args } = buildJobSearch({ page: 3, pageSize: 20 });
    expect(sql).toContain("LIMIT $1 OFFSET $2");
    expect(args).toEqual([20, 40]);

    const capped = buildJobSearch({ page: 1, pageSize: 999 });
    expect(capped.args[0]).toBe(50);
  });

  it("never interpolates user input into the SQL string", () => {
    const evil = "'; DROP TABLE \"Job\"; --";
    const { sql, args } = buildJobSearch({ q: evil, page: 1, pageSize: 20 });
    expect(sql).not.toContain(evil);
    expect(args[0]).toBe(evil);
    expect(sql).toContain("$1");
  });

  it("always filters to PUBLISHED", () => {
    const { sql } = buildJobSearch({ page: 1, pageSize: 20 });
    expect(sql).toContain(`j.status = 'PUBLISHED'`);
  });
});

describe("toSearchResult", () => {
  const row = (total: bigint | number): JobSearchRow =>
    ({
      id: "j1", slug: "s", title: "t", type: "FULL_TIME", locationType: "REMOTE",
      location: null, category: "ENGINEERING", experienceLevel: "MID",
      salaryMinCents: null, salaryMaxCents: null, salaryPeriod: "YEAR",
      salaryMonthlyCents: null, viewCount: 0, createdAt: new Date(),
      publishedAt: new Date(), featured: false, companyName: "c", companySlug: "c",
      logoUrl: null, isVerified: true, rank: 0, total,
    }) as JobSearchRow;

  it("extracts total from the window function and computes totalPages", () => {
    const result = toSearchResult([row(673n)], { page: 2, pageSize: 20 });
    expect(result.total).toBe(673);
    expect(result.totalPages).toBe(34);
    expect(result.page).toBe(2);
  });

  it("empty result → total 0, totalPages 1", () => {
    const result = toSearchResult([], { page: 5, pageSize: 20 });
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
  });
});

describe("salary normalization sanity across periods", () => {
  it("$50/hr ≈ $104,000/yr", () => {
    expect(toYearlyCents(5000, "HOUR")).toBe(10_400_000);
    expect(toMonthlyCents(5000, "HOUR")).toBe(866_667);
  });

  it("$2,000/wk ≈ $104,000/yr", () => {
    expect(toYearlyCents(200_000, "WEEK")).toBe(10_400_000);
  });

  it("all periods normalize the same annual salary consistently", () => {
    const monthly = [
      toMonthlyCents(10_400_000, "YEAR"),
      toMonthlyCents(866_667, "MONTH"),
      toMonthlyCents(200_000, "WEEK"),
      toMonthlyCents(40_000, "DAY"),
      toMonthlyCents(5_000, "HOUR"),
    ];
    const base = monthly[0];
    for (const m of monthly) {
      expect(Math.abs(m - base) / base).toBeLessThan(0.01);
    }
  });
});
