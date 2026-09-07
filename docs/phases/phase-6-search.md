# Phase 6 — Full-Text Search, Filters & Pagination

## Goals
1. The headline skill: **PostgreSQL full-text search** — weighted tsvector, `websearch_to_tsquery`, `ts_rank`, trigram partial matching — via parameterized raw SQL
2. Composable filters over the ranked result set
3. **Offset pagination with totals** (`COUNT(*) OVER()`) — page numbers + result counts in the UI
4. A pure, unit-testable search builder

## Steps

### 6.1 Search builder (src/lib/search.ts)
Pure function: `(params: SearchParams) => { sql, args }` — test every branch without a DB.

```ts
export interface SearchParams {
  q?: string;
  type?: JobType; locationType?: LocationType;
  experienceLevel?: ExperienceLevel; category?: Category;
  minSalary?: number; maxSalary?: number;   // monthly-normalized cents (see 6.2)
  remote?: boolean;
  postedWithin?: "24h" | "7d" | "30d";
  sort?: "relevant" | "newest" | "salary_desc";   // default: relevant if q, else newest
  page: number; pageSize: number;                 // pageSize cap = 50
}
```

Generated SQL shape:
```sql
SELECT j.id, j.slug, j.title, j.type, j.locationType, j.location, j.category,
       j.experienceLevel, j.salaryMinCents, j.salaryMaxCents, j.salaryPeriod,
       j.createdAt, j."publishedAt",
       c.name AS "companyName", c.slug AS "companySlug", c."logoUrl", c."isVerified",
       ts_rank(j."searchVector", websearch_to_tsquery('english', $1)) AS rank,
       COUNT(*) OVER() AS total
FROM "Job" j
JOIN "Company" c ON c.id = j."companyId"
WHERE j.status = 'PUBLISHED'
  AND ($1 = '' OR j."searchVector" @@ websearch_to_tsquery('english', $1)
                 OR j.title ILIKE '%' || $1 || '%')          -- pg_trgm partial match
  AND ($2::"JobType" IS NULL OR j.type = $2::"JobType")      -- one clause per optional filter
  ...
  AND ($8::timestamptz IS NULL OR j."publishedAt" >= $8)
ORDER BY <relevant → rank DESC, "publishedAt" DESC
        | newest → "publishedAt" DESC
        | salary_desc → COALESCE("salaryMaxCents","salaryMinCents",0) DESC>
LIMIT $9 OFFSET $10
```
Notes:
- Every dynamic value is a **parameter** — never string-concatenate `q` into SQL
- `websearch_to_tsquery` (not `plainto_tsquery`) so candidates can use `"senior react" -junior` syntax
- Salary filter normalization: convert every job to monthly cents via the `SalaryPeriod` multiplier, compare on one scale — build the normalization as a SQL `CASE` or precompute a `salaryMonthlyCents` generated column in the FTS migration (preferred: add it in the same raw migration, index it)
- Enum casts (`$2::"JobType"`) let one optional-clause pattern serve every filter

### 6.2 Salary normalization (extend Phase 1 migration)
```sql
ALTER TABLE "Job" ADD COLUMN "salaryMonthlyCents" int
  GENERATED ALWAYS AS (
    CASE "salaryPeriod"
      WHEN 'HOUR'  THEN COALESCE("salaryMaxCents","salaryMinCents") * 8   * 260 / 12
      WHEN 'DAY'   THEN COALESCE("salaryMaxCents","salaryMinCents") * 260 / 12
      WHEN 'WEEK'  THEN COALESCE("salaryMaxCents","salaryMinCents") * 52  / 12
      WHEN 'MONTH' THEN COALESCE("salaryMaxCents","salaryMinCents")
      WHEN 'YEAR'  THEN COALESCE("salaryMaxCents","salaryMinCents") / 12
    END) STORED;
CREATE INDEX "Job_salaryMonthly_idx" ON "Job" ("salaryMonthlyCents");
```
Filter compares `salaryMonthlyCents >= $min` / `<= $max`.

### 6.3 Public endpoint — GET /api/jobs
- Parse/validate query params (zod), defaults: `page=1`, `pageSize=20`
- Run builder SQL via `prisma.$queryRawUnsafe(sql, ...args)` (or `Prisma.sql` tagged template)
- Return `{ jobs, total, page, pageSize, totalPages }` — `total` from the window function's first row
- Empty `q` + no filters → plain newest-first listing (still offset-paginated)

### 6.4 URL-state UI hookup (functional; visual polish in Phase 9)
- `/jobs` reads `searchParams` → server-rendered first page; filter/sort interactions write back via `router.replace` with a scroll-preserving transition
- Debounced (300 ms) search input

### 6.5 Tests
- Builder output: query text + ordered params for — q only; q + each single filter; all filters together; salary min only; sort variants; pagination math (page 3 → offset 40)
- No user input appears un-parameterized in the SQL string (assert `q` only in args)
- Normalization: 50/hr ≈ 86,700/yr sanity checks across periods
- (DB integration, if seeded local PG available: seeded job found by title word, by description word, by partial "reac")

## Done When
- `/api/jobs?q=react&locationType=REMOTE&sort=relevant&page=1` returns ranked PUBLISHED jobs with `total`
- `EXPLAIN ANALYZE` on the search uses the GIN index (no seq scan at seed scale)
- Filter + sort + page combinations compose correctly via URL params
- Empty results state with a "clear filters" action
