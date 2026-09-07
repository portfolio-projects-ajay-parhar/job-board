# Phase 1 — Project Setup & Database

## Goals
1. Scaffold a fresh Next.js 16 app with TypeScript and Tailwind v4
2. Configure env vars for Supabase Postgres + storage (S3/Cloudinary) + Resend
3. Design and migrate the **complete job-board schema** (11 models + enums)
4. Add the **raw-SQL full-text-search migration** (tsvector + GIN + pg_trgm)
5. Seed a realistic two-sided marketplace dataset
6. Set up salary helpers and base layout

## Steps

### 1.1 Scaffold
```bash
npx create-next-app@latest job-board \
  --typescript --tailwind --eslint --app --src-dir
cd job-board
```

### 1.2 Install dependencies
```bash
npm install prisma @prisma/client
npm install @tanstack/react-query axios
npm install next-auth @auth/prisma-adapter bcryptjs
npm install zod react-hook-form @hookform/resolvers
npm install resend sanitize-html slugify date-fns lucide-react
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner cloudinary
npm install -D @types/sanitize-html @types/bcryptjs tsx vitest
```

### 1.3 Environment variables (.env.local)
```env
DATABASE_URL="postgres://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10"
DIRECT_URL="postgres://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"

NEXTAUTH_SECRET="<openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"

# storage — one of s3 | cloudinary | local (local = dev/test disk fallback)
STORAGE_PROVIDER="local"

AWS_REGION="us-east-1"
S3_BUCKET="jobboard-resumes-private"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."

CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."

RESEND_API_KEY="re_..."
EMAIL_FROM="careers@yourdomain.dev"
```
Also create `.env.example` mirroring all of the above with placeholders.

> Create the S3 bucket with **Block Public Access = all on** — resumes are confidential; nothing in this project serves objects by public URL.

### 1.4 Prisma schema (prisma/schema.prisma)
Full model list (see PLAN.md §Database Schema for fields and indexes):
- NextAuth: `Account`, `Session`, `User`, `VerificationToken`
- `User.role` enum `CANDIDATE | EMPLOYER | ADMIN` (default CANDIDATE)
- `CandidateProfile` (1:1 user; `skills String[]`), `Company` (1:1 owner; slug unique; `isVerified`)
- `Job` with enums: `JobType` (FULL_TIME|PART_TIME|CONTRACT|INTERNSHIP|TEMPORARY),
  `LocationType` (ONSITE|REMOTE|HYBRID), `Category` (ENGINEERING|DESIGN|PRODUCT|MARKETING|
  SALES|DATA|OPERATIONS|FINANCE|HR|OTHER), `ExperienceLevel` (ENTRY|MID|SENIOR|LEAD),
  `SalaryPeriod` (YEAR|MONTH|WEEK|DAY|HOUR), `JobStatus` (DRAFT|PUBLISHED|CLOSED|ARCHIVED)
- `Resume` (`ResumeProvider` S3|CLOUDINARY|LOCAL), `Application` (unique jobId+candidateId),
  `ApplicationEvent`, `SavedJob` (unique candidateId+jobId), `EmailLog`

Critical details:
- **Salary fields are `Int` cents** (`salaryMinCents`, `salaryMaxCents`) + `SalaryPeriod` — never Float, never mixed periods per row.
- **Do NOT put `searchVector` in the Prisma schema** — it is added by the raw-SQL migration below (Prisma can't model generated tsvector columns).
- `Application.resumeId` is a required FK to the exact resume submitted (snapshot semantics).
- `Resume.provider` records which storage backend holds the object, so downloads always hit the right provider.
- `ApplicationEvent` has `actorId`, `fromStatus?`, `toStatus`, `note?` — the audit trail for Phase 7/10.
- All indexes from PLAN.md §Indexes.

### 1.5 Migrate + full-text search migration
```bash
npx prisma migrate dev --name init
npx prisma generate
```
Then create a second migration with raw SQL (leave `migrations/` folder as Prisma made it; `prisma migrate dev --create-only` then edit, or hand-write the folder):
```bash
npx prisma migrate dev --create-only --name job_full_text_search
```
In the generated empty `migration.sql`:
```sql
-- Weighted full-text vector: title (A) > description (B) > location (C)
ALTER TABLE "Job" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("location", '')), 'C')
  ) STORED;

CREATE INDEX "Job_searchVector_gin" ON "Job" USING GIN ("searchVector");

-- Partial-word / prefix matching on titles ("reac" should still hint "react")
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Job_title_trgm_gin" ON "Job" USING GIN ("title" gin_trgm_ops);
```
```bash
npx prisma migrate dev   # applies it
```

### 1.6 Prisma client (src/lib/prisma.ts)
Copy the singleton from Project 6/7 verbatim (global-cached `PrismaClient`, pooled URL for runtime, `DIRECT_URL` for migrations).

### 1.7 Seed (prisma/seed.ts)
- bcrypt `Password123!` for all users: 1 ADMIN (`admin@jobboard.dev`), 6 EMPLOYERs (one company left `isVerified: false` for the admin demo), 8 CANDIDATEs
- `CandidateProfile` per candidate (varied skills arrays: `["React","TypeScript","Node.js"]`, …)
- 6 companies: varied `size`/`industry`/location, placeholder logos (picsum or initials data-URI)
- **36 jobs** spread across categories, types, levels, ONSITE/REMOTE/HYBRID; realistic cent salaries with mixed periods; 2 DRAFT, 3 CLOSED, the rest PUBLISHED with 4 `featured`; one PUBLISHED job with `applicationDeadline = tomorrow` and one with a **passed** deadline (guards tested in Phase 12)
- Resumes: `makeDummyPdf()` returns a minimal valid one-page PDF Buffer (~700 bytes, header `%PDF-1.4` … `%%EOF`) — upload via the storage layer with `STORAGE_PROVIDER=local`, 1–2 per candidate, first one `isPrimary`
- Applications: several candidates applied across multiple jobs covering every status, each with matching `ApplicationEvent` history rows (SUBMITTED→…) and correct `lastStatusAt`
- A few `SavedJob` rows; `EmailLog` starts empty

Add `"prisma": { "seed": "tsx prisma/seed.ts" }` to `package.json`, then `npm run db:seed`.

### 1.8 Salary helpers (src/lib/salary.ts)
```ts
const PERIOD_HOURS: Record<SalaryPeriod, number> = { HOUR: 1, DAY: 8, WEEK: 40, MONTH: 173, YEAR: 2080 };

// Normalize any salary to monthly cents — used by the salary-range filter in Phase 6
export const toMonthlyCents = (cents: number, period: SalaryPeriod): number =>
  Math.round((cents * PERIOD_HOURS[period] * 12) / 12) * (period === "YEAR" ? 1 / 12 : 1);

export const formatSalary = (minCents?: number, maxCents?: number, period: SalaryPeriod = "YEAR"): string => {
  if (!minCents && !maxCents) return "Salary not disclosed";
  const fmt = (c: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(c);
  const suffix = period === "YEAR" ? "/yr" : period === "HOUR" ? "/hr" : `/${period.toLowerCase()}`;
  if (minCents && maxCents) return `${fmt(minCents)} – ${fmt(maxCents)}${suffix}`;
  return `${fmt((minCents ?? maxCents)!)}${suffix}`;
};

export const parseSalaryToCents = (input: string): number => {
  const n = Number(input.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) throw new Error("invalid amount");
  return Math.round(n * 100);
};
```
(Finalize the normalization math in Phase 6 with tests — the filter compares all offers on one scale.)

### 1.9 Config & base layout
- `next.config.ts` — `images.remotePatterns` for Cloudinary host + picsum/unsplash
- `src/app/layout.tsx` (fonts, Providers wrapper placeholder), `globals.css`
- Root `page.tsx` placeholder (replaced in Phase 9)

## Done When
- `npx prisma migrate status` clean (both migrations applied); `npm run db:seed` succeeds
- `\d "Job"` in `psql`/`prisma studio` shows `searchVector`; `EXPLAIN SELECT * FROM "Job" WHERE "searchVector" @@ websearch_to_tsquery('english','react')` uses the GIN index
- `npm run dev` boots; seeded rows visible in Prisma Studio
- Unit test for `formatSalary`/`parseSalaryToCents` added and passing (starts the Vitest suite early)
