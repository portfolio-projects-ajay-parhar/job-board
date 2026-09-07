# Job Board — Complete Build Guide

## Project Overview

The second **Intermediate** project of the 20-project curriculum — a two-sided marketplace connecting **employers** and **candidates**, with an **admin** moderating the platform:

- **Guests** — browse and search jobs (public, SEO-friendly, paginated)
- **Candidates** — build a profile, upload resumes, search jobs with full-text search + filters, apply, track application status, save jobs
- **Employers** — own a company profile, post and manage jobs, review applications, move candidates through a hiring pipeline, download resumes
- **Admins** — platform stats, verify companies, feature/close jobs, manage users

Project 8 adds six genuinely new production concerns (designed fresh — nothing is assumed from Project 7):

1. **Three-role RBAC** — `CANDIDATE | EMPLOYER | ADMIN` with role-scoped route segments, guards, and an authorization matrix that is *tested*
2. **PostgreSQL full-text search** — a `tsvector` generated column (weighted title > description > location), GIN index, `websearch_to_tsquery` + `ts_rank` ranking, `pg_trgm` for partial matches — raw SQL where Prisma stops
3. **Confidential file uploads** — resumes (PDF/DOCX) stored **privately**; downloads only via short-lived signed URLs after an ownership check (candidate owner · employer of an applied job · admin)
4. **Pluggable document storage** — AWS S3 (private bucket + presigned URLs) **and** Cloudinary (raw/authenticated assets) both installed; `STORAGE_PROVIDER` env selects the backend, plus a `local` disk provider for dev/test
5. **Offset pagination with totals** — page-number pagination over ranked search results (`COUNT(*) OVER()`), a deliberate contrast to Project 7's cursor pagination
6. **Audited workflow state machine** — application statuses transition through an enforced server-side machine; every transition is written to an `ApplicationEvent` audit trail and triggers a transactional email

---

## Tech Stack

```text
Next.js 16 (App Router)          # same foundation as Project 7
TypeScript
Tailwind CSS v4
Supabase Postgres                # pooled (6543) runtime + direct (5432) migrations
Prisma 6                         # ORM (+ raw SQL for full-text search)
NextAuth v4                      # Credentials + JWT; roles CANDIDATE | EMPLOYER | ADMIN
Pluggable document storage       # AWS S3 (private + presigned) | Cloudinary (raw) | local (dev/test) via STORAGE_PROVIDER
Resend                           # transactional email (application + status notifications)
TanStack Query v5 + Axios
Zod + React Hook Form
sanitize-html, slugify, bcryptjs, date-fns, lucide-react
@aws-sdk/client-s3 + @aws-sdk/s3-request-presigner, cloudinary
Vitest                           # unit tests (status machine, upload validation, search builder, authz matrix)
GitHub Actions                   # CI/CD
Docker + docker-compose          # optional local Postgres
```

> **Why private storage + signed URLs?** Resumes are confidential documents. The bucket/blob is never public; every download is a 302 to a short-lived signed URL minted only after the server authorizes the requester against the application graph.

> **Why offset pagination here?** Ranked full-text results change between requests (recency boost, new posts), and candidates expect "Page 2 of 34 · 673 results". Offset + `COUNT(*) OVER()` is the honest choice for this UI — and a great README contrast against Project 7's keyset/cursor pagination.

---

## Architecture

### Route trees

```text
src/app/
├── (public)/                          # guest-browsable, server-rendered, SEO-aware
│    ├── page.tsx                       # home: hero search, featured jobs, categories, top companies
│    ├── jobs/page.tsx                  # search: q + filters + sort + offset pagination (URL state)
│    ├── jobs/[slug]/page.tsx           # detail: description, salary, apply CTA, company card, related
│    ├── companies/page.tsx             # company directory
│    └── companies/[slug]/page.tsx      # company profile + open roles
├── (auth)/
│    ├── signin/page.tsx
│    └── signup/page.tsx                # role toggle: Candidate | Employer (+ company name)
├── (candidate)/                        # CANDIDATE only
│    └── account/
│         ├── profile/page.tsx          # candidate profile + resume manager
│         ├── applications/page.tsx     # tracker with status timeline
│         └── saved/page.tsx
├── (employer)/                         # EMPLOYER only
│    └── employer/
│         ├── page.tsx                  # dashboard: active jobs, application funnel KPIs
│         ├── company/page.tsx          # company profile editor (+ logo upload)
│         ├── jobs/page.tsx + new + [id]/edit
│         └── jobs/[id]/applications/page.tsx   # pipeline: status columns/list + resume download
└── (admin)/                            # ADMIN only
     └── admin/
          ├── page.tsx                   # platform stats (users, companies, jobs, applications, 30-day series)
          ├── companies/page.tsx         # verify / unverify
          ├── jobs/page.tsx              # feature / unfeature, close
          └── users/page.tsx
```

API routes live under `src/app/api/*` (full list in PLAN §API Surface).

### Request flow — search → apply → pipeline → email

```text
search:
   Browser → /jobs?q=react&locationType=REMOTE&type=FULL_TIME&page=2
      → server component → searchBuilder (src/lib/search.ts):
          WHERE status = 'PUBLISHED'
            AND (searchVector @@ websearch_to_tsquery('english', $q)   -- ranked match
                 OR title ILIKE $partial)                              -- pg_trgm partial match
            AND type/level/category/locationType/salary/postedWithin filters
          SELECT ..., ts_rank(searchVector, query) AS rank,
                 COUNT(*) OVER() AS total
          ORDER BY rank DESC, publishedAt DESC
          LIMIT 20 OFFSET 20

apply:
   POST /api/jobs/[id]/apply  (CANDIDATE)
      → guards: role, job PUBLISHED, deadline not passed, unique (jobId, candidateId),
                resume ownership, not employer's own posting
      → create Application (SUBMITTED) + ApplicationEvent (audit)
      → email employer (application received) + email candidate (confirmation)

status change:
   PATCH /api/employer/applications/[id]  (EMPLOYER, own job)
      → validate transition against the status machine (SUBMITTED→IN_REVIEW→…)
      → update Application + insert ApplicationEvent (from→to, actor) in one transaction
      → email candidate (status changed)

resume download:
   GET /api/resumes/[id]/download
      → authorize: candidate owner | employer of a job with an Application referencing it | ADMIN
      → 302 → storage.getDownloadUrl(key, ttl = 120s)   # S3 presigned / Cloudinary signed
```

## Database Schema

```text
User (extends NextAuth)
 ├── id, email, name, image, passwordHash
 ├── role                (CANDIDATE | EMPLOYER | ADMIN)
 ├── CandidateProfile?   (1:1)
 └── Company?            (1:1 — employer owns exactly one company in this scope)

CandidateProfile ── userId (unique), fullName, headline?, location?, phone?, bio?,
                    skills String[], portfolioUrl?, githubUrl?, linkedinUrl?,
                    yearsOfExperience?

Company ── ownerUserId (unique), name, slug (unique), logoUrl?, website?, description?,
           location?, industry?, size (STARTUP_1_10 | SMALL_11_50 | MEDIUM_51_200 |
           LARGE_201_1000 | ENTERPRISE_1000_PLUS), foundedYear?, isVerified (admin-set, default false)

Job ── companyId → Company, slug (unique), title,
        description (sanitized HTML), responsibilities?, requirements?, benefits? (sanitized),
        type (FULL_TIME | PART_TIME | CONTRACT | INTERNSHIP | TEMPORARY),
        locationType (ONSITE | REMOTE | HYBRID), location?, country?,
        category (ENGINEERING | DESIGN | PRODUCT | MARKETING | SALES | DATA |
                  OPERATIONS | FINANCE | HR | OTHER),
        experienceLevel (ENTRY | MID | SENIOR | LEAD),
        salaryMinCents?, salaryMaxCents?, salaryPeriod (YEAR | MONTH | WEEK | DAY | HOUR),
        status (DRAFT | PUBLISHED | CLOSED | ARCHIVED),
        featured (bool, admin-set), applicationDeadline?,
        viewCount (default 0), publishedAt?, closesAt?, createdAt
        [searchVector tsvector — generated column via raw SQL migration, not in Prisma schema]

Resume ── candidateId → User, storageKey (unique), provider (S3 | CLOUDINARY | LOCAL),
          fileName, mimeType (PDF | DOCX), sizeBytes, isPrimary (bool), uploadedAt

Application ── jobId + candidateId (unique together), resumeId → Resume,
               coverLetter?, status (SUBMITTED | IN_REVIEW | INTERVIEW | OFFER | HIRED |
               REJECTED | WITHDRAWN), employerNote?, submittedAt, lastStatusAt

ApplicationEvent ── applicationId, fromStatus?, toStatus, note?, actorId, createdAt   (audit trail)

SavedJob ── candidateId + jobId (unique together), createdAt

EmailLog ── to, template, subject, status (SENT | FAILED | SKIPPED), meta (Json), createdAt
```

### Indexes

| Table | Index | Reason |
|---|---|---|
| `Job` | `slug` UNIQUE | Direct lookup from URL |
| `Job` | `searchVector` GIN | Full-text search (raw SQL migration) |
| `Job` | `title` gin_trgm_ops (pg_trgm) | Partial/typo-tolerant `ILIKE` matching |
| `Job` | `(status, publishedAt DESC)` | Default listing + new-jobs sort |
| `Job` | `(status, type)` / `(status, locationType)` / `(status, experienceLevel)` / `(status, category)` | Filter combinations |
| `Job` | `(status, salaryMaxCents)` | Salary-range filter |
| `Job` | `(companyId, status)` | Employer job manager |
| `Job` | `(status, featured, publishedAt DESC)` | Home featured rail |
| `Application` | `(jobId, candidateId)` UNIQUE | One application per candidate per job |
| `Application` | `(candidateId, submittedAt DESC)` | Candidate tracker |
| `Application` | `(jobId, status, lastStatusAt DESC)` | Employer pipeline |
| `ApplicationEvent` | `(applicationId, createdAt)` | Timeline rendering |
| `Resume` | `candidateId` / `storageKey` UNIQUE | Candidate's list / storage lookup |
| `SavedJob` | `(candidateId, jobId)` UNIQUE | Idempotent toggle |
| `Company` | `slug` UNIQUE / `ownerUserId` UNIQUE | URL lookup / one company per employer |

### Key invariants

- **Resumes are private by construction** — private S3 bucket / authenticated Cloudinary assets; every download path funnels through the authorization matrix (candidate owner · employer of an applied job · admin), then mints a ≤120s signed URL. Client-supplied filenames are never used as storage keys.
- **One application per candidate per job** — DB-level unique + friendly 409; applications blocked for non-PUBLISHED jobs and past-deadline jobs.
- **The status machine lives server-side** — invalid transitions return 422; every accepted transition inserts an `ApplicationEvent` (from → to, actor) in the same transaction. Terminal states: `HIRED`, `REJECTED`, `WITHDRAWN`.
- **`Application.resumeId` pins the exact resume** submitted — deleting a resume referenced by any application returns 409 (resume is part of the candidate's application record).
- **Rich text is sanitized on write and at render** (Project 6 pipeline: `sanitize-html`); cover letters are plain text only.
- **Salary is integer cents** with an explicit `salaryPeriod`; formatting happens only at the UI edge (`formatSalary`).

## API Surface

| Method | Route | Guard |
|---|---|---|
| POST | `/api/auth/register` | public (rate-limited) — role CANDIDATE or EMPLOYER (+ company name) |
| POST | `/api/auth/[...nextauth]` | NextAuth credentials |
| GET | `/api/jobs?q&type&locationType&experienceLevel&category&minSalary&maxSalary&remote&postedWithin&sort&page&pageSize` | public (PUBLISHED only, FTS + filters + offset pagination) |
| GET | `/api/jobs/[slug]` | public (DRAFT → 404 unless owner/admin; increments viewCount) |
| GET | `/api/companies?q&page` / `/api/companies/[slug]` | public |
| GET/PATCH | `/api/profile` | CANDIDATE (own CandidateProfile) |
| GET/POST | `/api/resumes` | CANDIDATE (multipart upload, validated) |
| DELETE | `/api/resumes/[id]` | CANDIDATE owner (409 if referenced by an application) |
| GET | `/api/resumes/[id]/download` | candidate owner · employer of applied job · ADMIN |
| POST | `/api/jobs/[id]/apply` | CANDIDATE (guards above) |
| GET | `/api/applications?page&status` | CANDIDATE (own tracker) |
| PATCH | `/api/applications/[id]/withdraw` | CANDIDATE owner (status machine) |
| GET/POST/DELETE | `/api/saved-jobs` + `/[jobId]` | CANDIDATE (toggle) |
| GET/PATCH | `/api/employer/company` | EMPLOYER (own Company) |
| GET/POST | `/api/employer/jobs` | EMPLOYER |
| GET/PATCH/DELETE | `/api/employer/jobs/[id]` | EMPLOYER owner (status machine: DRAFT/PUBLISHED/CLOSED/ARCHIVED) |
| GET | `/api/employer/jobs/[id]/applications?status&page` | EMPLOYER owner |
| GET | `/api/employer/applications?page&status&jobId` | EMPLOYER (cross-job list) |
| PATCH | `/api/employer/applications/[id]` | EMPLOYER owner (status transition + audit + email) |
| GET | `/api/employer/stats` | EMPLOYER (dashboard KPIs + funnel) |
| GET | `/api/admin/stats` | ADMIN (platform KPIs + 30-day series) |
| GET/PATCH | `/api/admin/companies` + `/[id]` | ADMIN (verify/unverify) |
| GET/PATCH | `/api/admin/jobs` + `/[id]` | ADMIN (feature/close) |
| GET | `/api/admin/users` | ADMIN |
| POST | `/api/media` | signed-in (image uploads — company logos) |

Errors normalized to `{ error: string }` (400/401/403/404/409/422/429/500). `409 ALREADY_APPLIED` and `422 INVALID_TRANSITION` carry current state for UI recovery.

---

## Security

- **Resume privacy** — no public object URLs; authorization matrix on every download; signed URLs expire in ≤120s; magic-byte sniffing (`%PDF-`, `PK\x03\x04`) in addition to MIME/extension checks; hard 5 MB limit; storage keys are server-generated UUIDs (`resumes/{candidateId}/{uuid}.pdf`).
- **RBAC everywhere** — `requireCandidate()`, `requireEmployer()`, `requireAdmin()`, plus resource-ownership checks (`requireCompanyOwner(jobId)`, `requireApplicationOwner(id)`); route segments `(candidate)`, `(employer)`, `(admin)` re-checked server-side in layout, not just hidden in the header.
- **Employers see applicants only for their own jobs** — applicant identity, cover letter, and resume are never exposed cross-company.
- **Status transitions and totals are server-authoritative** — the client sends intent, the server validates the machine and records the actor.
- Same-origin checks and per-route rate limits on register, apply, resume upload, media upload (Project 6 pattern).
- Job `description`/`responsibilities`/`requirements`/`benefits` HTML sanitized on write and at render; cover letters rendered as plain text.

---

## Phase Overview

| # | Phase | Deliverable |
|---|---|---|
| 1 | Project Setup & Database | Scaffold, env, full Prisma schema, raw-SQL FTS migration, seed |
| 2 | Authentication & Roles | NextAuth, 3-role signup, guards, role-aware header |
| 3 | Storage Layer & Company Profiles | Pluggable storage (S3/Cloudinary/local), media upload, company CRUD + public APIs |
| 4 | Job CRUD & Publishing | Employer job lifecycle (DRAFT→PUBLISHED→CLOSED), slugs, public detail API |
| 5 | Candidate Profiles & Resume Uploads | Profile CRUD, validated resume uploads, resume manager, signed downloads |
| 6 | Full-Text Search, Filters & Pagination | Ranked Postgres FTS + all filters + offset pagination, search builder tests |
| 7 | Applications & Hiring Pipeline | Apply flow, status machine + audit events, employer pipeline APIs, withdraw |
| 8 | Saved Jobs & Email Notifications | Saved-jobs toggle/page, Resend templates, EmailLog |
| 9 | Storefront Pages | Home, search page UI, job detail (+ JSON-LD JobPosting), company pages, SEO |
| 10 | Candidate & Employer Dashboards | Tracker with timeline, resume manager UI, employer pipeline UI |
| 11 | Admin Panel & Moderation | Platform stats, verify companies, feature/close jobs, users |
| 12 | Testing & Security | Vitest suites, download-authz matrix test, concurrent-apply test, RBAC smoke |
| 13 | CI/CD, Deployment & Documentation | GitHub Actions, Vercel, storage/email prod config, README, diagrams |

Each phase has its own file in [`phases/`](./phases/). Work **in order** — every phase depends on the previous one.
