export const PAGE_SIZE_CAP = 50;

/**
 * Pure, composable job-search builder → parameterized raw SQL.
 * Postgres full-text search: weighted tsvector + websearch_to_tsquery + ts_rank,
 * pg_trgm partial-match ILIKE arm, and offset pagination with COUNT(*) OVER().
 *
 * Every user-supplied value becomes a positional parameter — nothing that
 * comes from the request is ever concatenated into the SQL string.
 */

export type SortOption = "relevant" | "newest" | "salary_desc";
export type PostedWithin = "24h" | "7d" | "30d";

export interface SearchParams {
  q?: string;
  type?: string;
  locationType?: string;
  experienceLevel?: string;
  category?: string;
  /** monthly-normalized cents (see Job.salaryMonthlyCents generated column) */
  minSalary?: number;
  maxSalary?: number;
  remote?: boolean;
  postedWithin?: PostedWithin;
  sort?: SortOption;
  page: number;
  pageSize: number;
  /** injectable clock for deterministic tests */
  now?: Date;
}

export const POSTED_WITHIN_HOURS: Record<PostedWithin, number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
};

export function buildJobSearch(params: SearchParams): { sql: string; args: unknown[] } {
  const q = (params.q ?? "").trim();
  const sort: SortOption = params.sort ?? (q ? "relevant" : "newest");
  const page = Math.max(1, params.page);
  const pageSize = Math.min(PAGE_SIZE_CAP, Math.max(1, params.pageSize));

  const args: unknown[] = [];
  const next = (value: unknown) => `$${args.push(value)}`;

  // --- SELECT -----------------------------------------------------------------
  const rankExpr = q
    ? `ts_rank(j."searchVector", websearch_to_tsquery('english', ${next(q)}))`
    : "0";
  const select = `
    j.id, j.slug, j.title, j.type, j."locationType", j.location, j.category,
    j."experienceLevel", j."salaryMinCents", j."salaryMaxCents", j."salaryPeriod",
    j."salaryMonthlyCents", j."viewCount", j."createdAt", j."publishedAt", j.featured,
    c.name AS "companyName", c.slug AS "companySlug", c."logoUrl", c."isVerified",
    ${rankExpr} AS rank,
    COUNT(*) OVER() AS total`;

  // --- WHERE ------------------------------------------------------------------
  const clauses: string[] = [`j.status = 'PUBLISHED'`];

  if (q) {
    // same parameter reused for the empty-check, FTS match and trgm partial match
    const p = `$${args.length}`; // the q we just pushed
    clauses.push(
      `(${p}::text = '' OR j."searchVector" @@ websearch_to_tsquery('english', ${p}) OR j.title ILIKE '%' || ${p} || '%')`,
    );
  }

  const enumClause = (column: string, cast: string, value?: string) => {
    if (!value) return;
    const p = next(value);
    clauses.push(`(${p}::"${cast}" IS NULL OR j."${column}" = ${p}::"${cast}")`);
  };
  enumClause("type", "JobType", params.type);
  enumClause("locationType", "LocationType", params.locationType);
  enumClause("experienceLevel", "ExperienceLevel", params.experienceLevel);
  enumClause("category", "Category", params.category);

  if (params.minSalary !== undefined && params.minSalary !== null) {
    const p = next(params.minSalary);
    clauses.push(`(${p}::int IS NULL OR j."salaryMonthlyCents" >= ${p}::int)`);
  }
  if (params.maxSalary !== undefined && params.maxSalary !== null) {
    const p = next(params.maxSalary);
    clauses.push(`(${p}::int IS NULL OR j."salaryMonthlyCents" <= ${p}::int)`);
  }

  if (params.remote === true) {
    clauses.push(`j."locationType" = 'REMOTE'`);
  }

  if (params.postedWithin) {
    const hours = POSTED_WITHIN_HOURS[params.postedWithin];
    const cutoff = new Date((params.now ?? new Date()).getTime() - hours * 3600_000);
    const p = next(cutoff.toISOString());
    clauses.push(`(${p}::timestamptz IS NULL OR j."publishedAt" >= ${p}::timestamptz)`);
  }

  // --- ORDER BY ----------------------------------------------------------------
  const orderBy =
    sort === "relevant"
      ? `rank DESC, j."publishedAt" DESC`
      : sort === "salary_desc"
        ? `j."salaryMonthlyCents" DESC NULLS LAST, j."publishedAt" DESC`
        : `j."publishedAt" DESC`;

  // --- PAGINATION ----------------------------------------------------------------
  const limit = next(pageSize);
  const offset = next((page - 1) * pageSize);

  const sql = `
SELECT ${select}
FROM "Job" j
JOIN "Company" c ON c.id = j."companyId"
WHERE ${clauses.join("\n  AND ")}
ORDER BY ${orderBy}
LIMIT ${limit} OFFSET ${offset}`.trim();

  return { sql, args };
}

/** Shape of one row returned by the builder. */
export type JobSearchRow = {
  id: string;
  slug: string;
  title: string;
  type: string;
  locationType: string;
  location: string | null;
  category: string;
  experienceLevel: string;
  salaryMinCents: number | null;
  salaryMaxCents: number | null;
  salaryPeriod: string;
  salaryMonthlyCents: number | null;
  viewCount: number;
  createdAt: Date;
  publishedAt: Date | null;
  featured: boolean;
  companyName: string;
  companySlug: string;
  logoUrl: string | null;
  isVerified: boolean;
  rank: number;
  total: bigint | number;
};

export type JobSearchResult = {
  jobs: JobSearchRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function toSearchResult(
  rows: JobSearchRow[],
  params: Pick<SearchParams, "page" | "pageSize">,
): JobSearchResult {
  const pageSize = Math.min(PAGE_SIZE_CAP, Math.max(1, params.pageSize));
  const total = rows.length > 0 ? Number(rows[0].total) : 0;
  return {
    jobs: rows,
    total,
    page: Math.max(1, params.page),
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Runs the builder against the database. */
export async function searchJobs(
  prisma: { $queryRawUnsafe: (sql: string, ...args: unknown[]) => Promise<unknown[]> },
  params: SearchParams,
): Promise<JobSearchResult> {
  const { sql, args } = buildJobSearch(params);
  const raw = (await prisma.$queryRawUnsafe(sql, ...args)) as JobSearchRow[];
  // BigInt (COUNT(*) OVER()) is not JSON-serializable — normalize per row
  const rows = raw.map((r) => ({ ...r, total: Number(r.total) }));
  return toSearchResult(rows, params);
}
