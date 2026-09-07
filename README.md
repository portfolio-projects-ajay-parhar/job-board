# JobBoard — Two-Sided Job Marketplace

A production-shaped **job board** connecting employers, candidates, and admins — built with Next.js 16 (App Router), PostgreSQL, Prisma, and NextAuth. The signature engineering concerns: **PostgreSQL full-text search** over a weighted `tsvector`, **confidential resume storage** with short-lived signed downloads behind a tested authorization matrix, **pluggable document storage** (S3 / Cloudinary / local), an **audited hiring-pipeline state machine**, and **offset pagination with totals**.

> **Status: complete** — all 13 phases implemented; `next build`, `tsc --noEmit`, ESLint, and 81 unit tests green; 12-step end-to-end smoke suite passing on a freshly seeded database. What remains is external deployment setup (GitHub remote, Vercel, S3/Cloudinary/Resend keys) — see [Deployment](#deployment).

[![CI](https://github.com/YOUR_GH_USERNAME/job-board/actions/workflows/ci.yml/badge.svg)](./.github/workflows/ci.yml)
<!-- ↑ after pushing to GitHub, replace YOUR_GH_USERNAME with your account -->

## Table of Contents

1. [Problem](#problem)
2. [Features](#features)
3. [Tech Stack](#tech-stack)
4. [Architecture](#architecture)
5. [Data Model](#data-model)
6. [API Surface](#api-surface)
7. [Full-Text Search Deep Dive](#full-text-search-deep-dive)
8. [Pagination Trade-off: Offset vs Cursor](#pagination-trade-off-offset-vs-cursor)
9. [Private Resumes & Signed-URL Authorization Matrix](#private-resumes--signed-url-authorization-matrix)
10. [State Machines](#state-machines)
11. [Security Review](#security-review)
12. [Testing](#testing)
13. [Getting Started](#getting-started)
14. [Environment Variables](#environment-variables)
15. [Seed Accounts](#seed-accounts)
16. [CI/CD](#cicd)
17. [Deployment](#deployment)

## Problem

Generic job boards treat search as `ILIKE '%term%'` and treat resumes as files on a public CDN. This project takes the two hard problems seriously:

- **Candidates** need ranked, forgiving search (typo-tolerant partial matches, filters, honest result counts) and confidence that their resumes are **never publicly reachable**.
- **Employers** need an auditable pipeline — every status change recorded with who/when/why — not a spreadsheet.
- **Admins** need moderation levers (verify companies, feature jobs) that visibly change the storefront.

## Features

- **Guests** — SEO-friendly browsing with JSON-LD `JobPosting` structured data, sitemap, robots
- **Candidates** — profile with skills, PDF/DOCX resume uploads (magic-byte validated), FTS job search with filters, apply with cover letter + resume, application tracker with audit timelines, saved jobs
- **Employers** — company profile with logo upload, job CRUD with a publishing state machine, hiring pipeline (kanban by status), machine-legal status transitions with notes, signed resume downloads
- **Admins** — platform KPIs + 30-day series chart, company verification, job featuring/closing, user directory
- **Email** — Resend transactional email with a full `EmailLog` audit (SKIPPED/SENT/FAILED)

## Tech Stack

```text
Next.js 16 (App Router) · TypeScript · Tailwind CSS v4
PostgreSQL 16 (Docker dev / Supabase prod) · Prisma 6 (+ raw SQL for FTS)
NextAuth v4 (Credentials + JWT, 3-role RBAC)
TanStack Query v5 · Axios · Zod (server + client validation)
sanitize-html · slugify · bcryptjs · date-fns · lucide-react
@aws-sdk/client-s3 + s3-request-presigner · cloudinary · Resend
Vitest (81 unit tests) · GitHub Actions · Docker
```

## Architecture

```text
Browser ──▶ Next.js App Router (RSC for public pages, client components for dashboards)
             │
             ├─ src/lib/auth-guards.ts      requireCandidate/Employer/Admin/CompanyOwner/…
             ├─ src/lib/search.ts           pure FTS builder → parameterized raw SQL
             ├─ src/lib/storage/            pluggable: S3 | Cloudinary | local (HMAC links)
             ├─ src/lib/application-status  audited hiring state machine
             └─ src/lib/email.ts            Resend + EmailLog (never blocks a response)
                   │
                   └─▶ PostgreSQL — 11 Prisma models + generated tsvector + salary normalization
```

Request flows (search → apply → pipeline → email) are documented in [`docs/PLAN.md`](docs/PLAN.md).

### Project structure

```text
src/
├── app/
│   ├── (public)/          # home, /jobs (+ detail, JSON-LD), /companies — SEO-aware RSC
│   ├── (auth)/            # /signin, /signup (role toggle)
│   ├── (candidate)/account/   # profile + resumes, applications tracker, saved
│   ├── (employer)/employer/   # dashboard, company, jobs, hiring pipeline
│   ├── (admin)/admin/         # stats, moderation, users
│   └── api/               # route handlers — every mutation guard-checked
├── components/            # providers (Session/Query/Toast), header, JobCard
├── lib/                   # auth, auth-guards, search, storage/, email, state machines
└── types/                 # NextAuth role augmentation
prisma/                    # schema + 3 migrations (2 raw-SQL: FTS, salary normalization)
scripts/                   # smoke.mjs (e2e), verify-phase7.mjs
docs/                      # PLAN.md, TASKS.md, SECURITY.md, diagrams
```

Planning and phase-by-phase build notes live in [`docs/PLAN.md`](docs/PLAN.md), [`docs/TASKS.md`](docs/TASKS.md), and [`tasks-progress.md`](tasks-progress.md).

## Data Model

11 models: `User` (role: `CANDIDATE|EMPLOYER|ADMIN`), `CandidateProfile`, `Company`, `Job`, `Resume`, `Application` (unique per candidate+job), `ApplicationEvent` (audit trail), `SavedJob`, `EmailLog`, plus NextAuth's `Account`/`Session`/`VerificationToken`.

Key columns added by **raw SQL migrations** (Prisma cannot express them):

- `Job.searchVector` — generated weighted tsvector (title A, description B, location C) + GIN index
- `Job.salaryMonthlyCents` — generated monthly-normalized salary + btree index (filter scale)

Full field list and all 14 indexes: [`docs/PLAN.md` §Database Schema](docs/PLAN.md).

## API Surface

Every route returns normalized `{ error, code? }` errors (400/401/403/404/409/413/415/422/429/500). Highlights:

| Method | Route | Guard |
|---|---|---|
| POST | `/api/auth/register` | public, rate-limited — never mints ADMIN |
| GET | `/api/jobs?q&type&…&sort&page` | public — ranked FTS + filters + totals |
| GET | `/api/jobs/[slug]` | public — DRAFT → 404 unless owner/admin |
| GET/POST/DELETE | `/api/saved-jobs` (+`[jobId]`) | CANDIDATE — idempotent toggle |
| POST | `/api/jobs/[slug]/apply` | CANDIDATE — deadline/uniqueness/resume-ownership guards |
| PATCH | `/api/applications/[id]/withdraw` | CANDIDATE owner — machine-validated |
| GET/PATCH | `/api/profile`, `/api/resumes*` | CANDIDATE owner |
| GET | `/api/resumes/[id]/download` | candidate owner · applied-job employer · ADMIN → 302 signed URL (120s) |
| POST/GET/PATCH/DELETE | `/api/employer/jobs*` | EMPLOYER owner (job status machine) |
| GET/PATCH | `/api/employer/applications*` | EMPLOYER owner (pipeline) |
| GET | `/api/admin/stats` · `/api/admin/{companies,jobs,users}` | ADMIN |

## Full-Text Search Deep Dive

`src/lib/search.ts` is a **pure function** `(params) → { sql, args }` composing parameterized raw SQL:

```sql
SELECT …, ts_rank(j."searchVector", websearch_to_tsquery('english', $1)) AS rank,
       COUNT(*) OVER() AS total
FROM "Job" j JOIN "Company" c ON c.id = j."companyId"
WHERE j.status = 'PUBLISHED'
  AND ($1::text = '' OR j."searchVector" @@ websearch_to_tsquery('english', $1)
                  OR j.title ILIKE '%' || $1 || '%')          -- pg_trgm partial match
  AND ($2::"JobType" IS NULL OR j.type = $2::"JobType")       -- per-filter optional clause
  …
ORDER BY rank DESC, j."publishedAt" DESC   -- or newest / salary_desc
LIMIT $n OFFSET $m
```

- **Weighting** — the generated column weights title A, description B, location C, so title matches outrank body mentions.
- **`websearch_to_tsquery`** — supports quoted phrases and `-excluded` terms with safe, English-snapped parsing.
- **pg_trgm fallback** — `ILIKE '%reac%'` catches prefixes/partial words the dictionary misses (verified: `reac` finds React roles). `EXPLAIN` shows a `BitmapOr` over both GIN indexes.
- **Every dynamic value is a parameter** — asserted by unit test (injection probe).

## Pagination Trade-off: Offset vs Cursor

This project deliberately uses **offset pagination** (`LIMIT/OFFSET` + `COUNT(*) OVER()`), the opposite of a keyset/cursor design:

- Ranked results shift between requests (recency ordering, new posts) — a cursor pins users to a stale position; candidates expect stable *page numbers*.
- The UI contract demands "Page 2 of 34 · 673 results" — only `COUNT(*) OVER()` (one window pass) provides honest totals.
- Cost: `OFFSET 10000` scans and discards 10k rows. At job-board scale (10k–100k PUBLISHED jobs) with composite `(status, …)` indexes this stays fast; the cursor migration path is documented as future work.

## Private Resumes & Signed-URL Authorization Matrix

Resumes are never publicly reachable. Every download funnels through one route that authorizes against the application graph, then 302s to a ≤120s signed URL:

| Requester | Result |
|---|---|
| Resume owner (candidate) | 302 → signed URL |
| Employer whose company owns a job with a referencing Application | 302 |
| ADMIN | 302 |
| Other candidate / unrelated employer | **404** (existence not leaked) |
| Guest | **401** |

Uploads are hardened independently: MIME allowlist + **magic-byte sniff** (`%PDF-`, `PK\x03\x04`) + 5 MB hard limit + server-generated UUID keys (`resumes/{candidateId}/{uuid}.pdf`) — the client's filename is display-only.

## State Machines

- **Job**: `DRAFT → PUBLISHED → CLOSED → PUBLISHED (reopen)`; `ARCHIVED` terminal. Illegal → 422 `INVALID_TRANSITION`.
- **Application**: `SUBMITTED → IN_REVIEW → INTERVIEW → OFFER → HIRED`, strictly forward; `REJECTED` from any live stage; `WITHDRAWN` (candidate) until HIRED; terminal: HIRED/REJECTED/WITHDRAWN. Every accepted transition writes an `ApplicationEvent` (from → to, actor, note) in the same transaction and emails the candidate post-commit.

## Security Review

The full checklist with evidence lives in [`docs/SECURITY.md`](docs/SECURITY.md). Highlights: parameterized SQL only (tested), sanitize-on-write **and** render, rate limits on all sensitive endpoints, ownership guards on every mutation, no ADMIN via registration, no stack traces in responses.

## Testing

```bash
npm test                   # 81 Vitest unit tests (pure logic — no DB required)
node scripts/smoke.mjs     # 12-step end-to-end suite (needs dev server + seeded DB)
```

Signature tests: download-authorization matrix (live), concurrent duplicate apply (exactly one 201 + one 409), deadline guard (422), withdraw-after-HIRED (422), SQL-injection probe, signed-link tamper/expiry.

## Getting Started

```bash
# 1. Postgres (or point DATABASE_URL at Supabase)
docker run -d --name jobboard-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=jobboard -p 5432:5432 postgres:16-alpine

# 2. Install + migrate + seed
npm install
cp .env.example .env          # Prisma CLI reads .env; Next.js layers .env.local on top if present
npx prisma generate
npx prisma migrate deploy
npm run db:seed

# 3. Run
npm run dev        # http://localhost:3000
```

## Environment Variables

See [`.env.example`](.env.example) — Supabase pooled (6543) + direct (5432) URLs, `NEXTAUTH_SECRET`, `STORAGE_PROVIDER` (`s3|cloudinary|local`), AWS/Cloudinary keys, `RESEND_API_KEY`, `EMAIL_FROM`. Unconfigured email logs `SKIPPED` rows instead of failing.

## Seed Accounts

All passwords: `Password123!`

| Role | Email |
|---|---|
| Admin | `admin@jobboard.dev` |
| Employers | `employer1@jobboard.dev` … `employer6@jobboard.dev` (6th company unverified) |
| Candidates | `candidate1@jobboard.dev` … `candidate8@jobboard.dev` |

36 seeded jobs (2 DRAFT, 3 CLOSED, 4 featured, deadline edge cases), 14 applications covering every status with audit history.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`): Postgres service → `npm ci` → `prisma migrate deploy` → lint → type-check → unit tests → build. Optional containerized dev: `docker compose up`.

## Deployment

1. **Vercel**: import the repo; set all env vars (`DATABASE_URL` = Supabase pooled 6543, `DIRECT_URL` = 5432, rotate `NEXTAUTH_SECRET`, `STORAGE_PROVIDER=s3` with a **private** bucket).
2. **S3**: create the bucket with Block Public Access fully on.
3. **Resend**: verify the sending domain; update `EMAIL_FROM`.
4. Run `npx prisma migrate deploy` against prod, then `node scripts/smoke.mjs` with `SMOKE_URL=https://your-app.vercel.app`.
5. Enable branch protection on `main` requiring green CI.

