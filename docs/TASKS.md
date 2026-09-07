# Job Board — Agent Task List

> **STATUS: NOT STARTED (2026-09-06)** — plan complete, implementation pending.

> Derived from [`PLAN.md`](./PLAN.md) and the individual files in the [`phases/`](./phases/) directory. Work through phases **in order** — each phase depends on the previous one being complete. Mark tasks `[/]` when in progress and `[x]` when done.

---

## Prerequisites & Environment

- [ ] **Supabase project** provisioned (Postgres pooled 6543 + direct 5432 connection strings)
- [ ] **AWS account** — IAM user with S3 access + **private** bucket for resumes (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`)
- [ ] **Cloudinary account** — API key/secret (raw/authenticated uploads) — both providers configured; `STORAGE_PROVIDER` env picks one
- [ ] **Resend account** (free tier) — API key + verified sender domain
- [ ] Node.js >= 18 and npm available in PATH
- [ ] `gh` CLI authenticated (for repo creation + Actions)

---

## Phase 1 — Project Setup & Database

### 1.1 Scaffold
- [ ] `npx create-next-app@latest job-board --typescript --tailwind --eslint --app --src-dir`
- [ ] Install deps:
  - `prisma @prisma/client`
  - `@tanstack/react-query axios`
  - `next-auth @auth/prisma-adapter bcryptjs`
  - `zod react-hook-form @hookform/resolvers`
  - `resend`, `sanitize-html slugify date-fns lucide-react`
  - `@aws-sdk/client-s3 @aws-sdk/s3-request-presigner cloudinary`
  - dev: `@types/sanitize-html @types/bcryptjs tsx vitest`

### 1.2 Environment Variables
- [ ] `.env.local`: `DATABASE_URL` (pooled), `DIRECT_URL` (direct), `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `STORAGE_PROVIDER` (`s3` | `cloudinary` | `local`), `AWS_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`
- [ ] `.env.example` mirroring all vars with placeholders

### 1.3 Prisma Schema
- [ ] NextAuth models: `User`, `Account`, `Session`, `VerificationToken`
- [ ] `User.role` enum `CANDIDATE | EMPLOYER | ADMIN` (default CANDIDATE)
- [ ] `CandidateProfile` (1:1 user, skills String[]), `Company` (1:1 owner, slug unique, `isVerified`)
- [ ] `Job` — all fields + enums `JobType`, `LocationType`, `Category`, `ExperienceLevel`, `SalaryPeriod`, `JobStatus`
- [ ] `Resume` (`provider` enum, `storageKey` unique, `isPrimary`), `Application` (unique jobId+candidateId), `ApplicationEvent`, `SavedJob` (unique candidateId+jobId), `EmailLog`
- [ ] All indexes from PLAN.md (job filters, application lookups, saved-job toggle)
- [ ] `npx prisma migrate dev --name init` + `npx prisma generate`
- [ ] **Raw-SQL FTS migration**: `searchVector` generated tsvector (title A, description B, location C) + GIN index; `pg_trgm` extension + trigram GIN on `Job.title` (see phase file)
- [ ] Singleton client `src/lib/prisma.ts`

### 1.4 Seed (prisma/seed.ts)
- [ ] 1 ADMIN, 6 EMPLOYERs (1 company unverified), 8 CANDIDATEs (password `Password123!`)
- [ ] Candidate profiles with skills arrays
- [ ] 6 companies (varied size/industry, placeholder logos)
- [ ] 36 jobs: spread across categories/types/levels/location types; 2 DRAFT, 3 CLOSED, rest PUBLISHED (4 featured); one PUBLISHED job with tomorrow's `applicationDeadline`, one with a passed deadline (for guard tests)
- [ ] Resumes: `makeDummyPdf()` buffer uploaded through the `local` provider (dev/test fallback); 1–2 per candidate
- [ ] Applications across all statuses + matching `ApplicationEvent` history rows; some SavedJobs
- [ ] Package script: `"db:seed": "tsx prisma/seed.ts"`

### 1.5 Config & Layout
- [ ] `next.config.ts` — `images.remotePatterns` (Cloudinary host + picsum/unsplash)
- [ ] `src/app/layout.tsx` + `globals.css` + providers wrapper placeholder
- [ ] `src/lib/salary.ts` — `formatSalary(minCents, maxCents, period)`, `parseSalaryToCents(input)`

---

## Phase 2 — Authentication & Roles

- [ ] NextAuth options (Credentials + Prisma adapter + JWT), `session.strategy: "jwt"`
- [ ] JWT/session callbacks copying `id`/`role` onto token and session
- [ ] Type augmentation `src/types/next-auth.d.ts` (role union type)
- [ ] `POST /api/auth/register` — zod + bcrypt + role param; EMPLOYER signup creates `Company` (name + slug) in one transaction; 409 conflict; rate limit
- [ ] Guards: `requireUser()`, `requireRole(role)`, `requireCandidate()`, `requireEmployer()`, `requireAdmin()`, `requireCompanyOwner(resourceId)`, `requireApplicationParticipant(id)` throwing `AuthError`
- [ ] Providers: Session, Query, Toast
- [ ] `/signin` and `/signup` (role toggle: Candidate | Employer with company-name field; Suspense-wrapped `useSearchParams`)
- [ ] Role-aware header: browse links + candidate menu | employer menu | admin link, per session role
- [ ] Server-side role check in `(candidate)`, `(employer)`, `(admin)` layouts (redirect on mismatch — not just hidden UI)

---

## Phase 3 — Storage Layer & Company Profiles

- [ ] Pluggable storage `src/lib/storage/` — interface `upload(key, buffer, contentType)`, `getDownloadUrl(key, ttlSeconds)`, `delete(key)` behind one `getStorage()` factory:
  - `s3` — private bucket, presigned GET via `@aws-sdk/s3-request-presigner`
  - `cloudinary` — `resource_type: "raw"`, authenticated assets, signed delivery URLs
  - `local` — dev/test: `.uploads/` dir, streamed download (same authorization path)
- [ ] `POST /api/media` — signed-in, **images only** (logos): MIME + magic-byte allowlist, 2 MB limit, `/api/media` key scheme
- [ ] `GET/PATCH /api/employer/company` — EMPLOYER owns exactly one company; zod-validated profile fields
- [ ] `GET /api/companies` (public, search + page) and `GET /api/companies/[slug]` (profile + PUBLISHED job count)
- [ ] Company profile editor page (`/employer/company`) with logo upload
- [ ] Unit tests: storage factory selection by env, media validation rejects non-images

---

## Phase 4 — Job CRUD & Publishing

- [ ] `POST /api/employer/jobs` (EMPLOYER) — zod, slugify with uniqueness, sanitize all rich-text fields, salary in cents + period, create as DRAFT or PUBLISHED
- [ ] `PATCH /api/employer/jobs/[id]` — edit while DRAFT/PUBLISHED; `requireCompanyOwner`
- [ ] `PATCH /api/employer/jobs/[id]/status` — job status machine DRAFT→PUBLISHED→CLOSED (→PUBLISHED reopen), ARCHIVED terminal; sets `publishedAt`/`closesAt`
- [ ] `DELETE /api/employer/jobs/[id]` — soft (ARCHIVED) only; applications preserved
- [ ] `GET /api/jobs/[slug]` — public detail (company, salary, counts); DRAFT → 404 for non-owner/non-admin; increments `viewCount`
- [ ] Employer jobs list page + job form (new/edit) with all field groups (type, location, category, level, salary, deadline, rich text)

---

## Phase 5 — Candidate Profiles & Resume Uploads

- [ ] `GET/PATCH /api/profile` — CANDIDATE CandidateProfile (skills array input, URLs validated)
- [ ] `POST /api/resumes` — multipart: MIME allowlist (PDF/DOCX) + extension check + **magic-byte sniff** (`%PDF-`, `PK\x03\x04`) + 5 MB limit; server-generated key `resumes/{candidateId}/{uuid}.{ext}`; `isPrimary` handling (first upload primary; demote others)
- [ ] `GET /api/resumes` (own list), `DELETE /api/resumes/[id]` — **409 when referenced by an Application**
- [ ] `GET /api/resumes/[id]/download` — authorize (owner) → 302 to `storage.getDownloadUrl(key, 120s)`
- [ ] Profile page: candidate fields editor + resume manager (upload, list, set primary, delete)
- [ ] Unit tests: magic-byte validation, size limit, filename sanitization (display-only), storage key generation

---

## Phase 6 — Full-Text Search, Filters & Pagination

- [ ] Search builder `src/lib/search.ts` — composes parameterized raw SQL:
  - [ ] `websearch_to_tsquery('english', $q)` against `searchVector` + `ts_rank` (weighted A/B/C)
  - [ ] `pg_trgm` partial-match OR-arm: `title ILIKE '%'||$q||'%'` for prefixes/partial words
  - [ ] Filters: `type`, `locationType`, `experienceLevel`, `category`, `minSalary`/`maxSalary` (normalized to cents), `remote` shortcut, `postedWithin` (24h/7d/30d)
  - [ ] `sort`: `relevant` (rank DESC, publishedAt DESC — default when q present) | `newest` | `salary_desc`
  - [ ] Offset pagination: `LIMIT $pageSize OFFSET $offset`, total via `COUNT(*) OVER()`
- [ ] `GET /api/jobs` — public endpoint wiring the builder (PUBLISHED only, empty q → plain listing)
- [ ] `/jobs` page reads/writes URL search params (shareable filtered URLs)
- [ ] Unit tests: SQL composition (query text + params) for every filter combination, salary normalization, pagination math

---

## Phase 7 — Applications & Hiring Pipeline

- [ ] `POST /api/jobs/[id]/apply` — CANDIDATE; guards: job PUBLISHED, `applicationDeadline` not passed, resume ownership, **unique (jobId, candidateId) → 409 ALREADY_APPLIED**; creates Application (SUBMITTED) + first ApplicationEvent in one transaction
- [ ] Application status machine `src/lib/application-status.ts`:
  `SUBMITTED → IN_REVIEW → INTERVIEW → OFFER → HIRED`; `REJECTED` from any non-terminal stage; candidate `WITHDRAWN` until HIRED; terminal: HIRED/REJECTED/WITHDRAWN
- [ ] `PATCH /api/employer/applications/[id]` — EMPLOYER of that job; validates transition (422 on invalid) → update + ApplicationEvent (from→to, actorId, note?) in one transaction
- [ ] `GET /api/employer/jobs/[id]/applications` and cross-job `GET /api/employer/applications` — status filter + offset pagination
- [ ] `PATCH /api/applications/[id]/withdraw` — CANDIDATE owner; machine-validated
- [ ] Employer resume download authorization: employer role passes `/api/resumes/[id]/download` check only via an Application referencing the resume on one of their jobs
- [ ] Unit tests: status machine (every legal transition accepted, every illegal 422), concurrent duplicate apply (unique violation → friendly 409)

---

## Phase 8 — Saved Jobs & Email Notifications

- [ ] `GET/POST/DELETE /api/saved-jobs` + `[jobId]` toggle — unique constraint makes it idempotent; saved-jobs page listing
- [ ] Email service `src/lib/email.ts` (Resend) + `EmailLog` row per send; **skip gracefully** (log SKIPPED) when unconfigured
- [ ] Templates: `welcome` (candidate/employer), `application-received` (→ employer, link to pipeline), `application-confirmation` (→ candidate), `application-status-changed` (→ candidate, includes new status)
- [ ] Wire sends into apply + status-change transactions (send after commit; log failures, never block the API response)
- [ ] Unit tests: template rendering, EmailLog statuses

---

## Phase 9 — Storefront Pages

- [ ] `(public)` layout + navbar (search box, role-aware account menu) + footer
- [ ] Home: hero with search, featured rail, category tiles (job counts), recent jobs, top verified companies
- [ ] `/jobs`: debounced search input, filter sidebar (type, location type, level, category, salary range, remote toggle, posted-within), sort dropdown, **pagination controls with totals** ("Page 2 of 34 · 673 results"), empty/loading states
- [ ] `/jobs/[slug]`: sanitized description sections, salary display, company card, apply CTA (states: apply → applied → closed/deadline-passed), save button, related jobs (same category), `generateMetadata` + **JSON-LD `JobPosting` schema**, view count
- [ ] `/companies` + `/companies/[slug]` (profile, verified badge, open roles)
- [ ] SEO: `sitemap.ts` (published jobs + companies), `robots.ts`, OpenGraph metadata
- [ ] `loading.tsx` skeletons on every public segment

---

## Phase 10 — Candidate & Employer Dashboards

- [ ] `/account/profile` — candidate profile form + resume manager (upload/primary/delete) wired to APIs
- [ ] `/account/applications` — tracker grouped by status; status timeline per application (from ApplicationEvent); withdraw action
- [ ] `/account/saved` — saved jobs list with unsave + apply shortcuts
- [ ] `/employer` dashboard — active jobs, total/new applications, per-job funnel counts (SUBMITTED→…→HIRED), quick links
- [ ] `/employer/jobs` — table with status filter + status actions (publish/close/reopen)
- [ ] `/employer/jobs/[id]/applications` — pipeline view: columns (or grouped list) by status; detail drawer (cover letter, candidate headline, resume download); status-change buttons (machine-legal only) + note input
- [ ] Optimistic updates + toast feedback on all mutations

---

## Phase 11 — Admin Panel & Moderation

- [ ] `(admin)` layout with `requireAdmin()` server-side guard
- [ ] `/admin` — platform KPIs: users by role, companies (verified vs not), jobs by status, applications by status, 30-day signup/application series (chart)
- [ ] `/admin/companies` — verify/unverify (affects home "verified" surfaces)
- [ ] `/admin/jobs` — feature/unfeature, close any job; search + status filter
- [ ] `/admin/users` — list with role badges + join date
- [ ] RBAC check: every `/api/admin/*` route rejects non-admin with 403 (smoke-tested in Phase 12)

---

## Phase 12 — Testing & Security

- [ ] Vitest unit tests: application status machine (all transitions), job status machine, magic-byte/MIME/size validation, search SQL composition + salary normalization, storage factory + signed-URL TTL, email template rendering, slug uniqueness helper
- [ ] **Download authorization matrix test** — candidate owner ✓, employer of applied job ✓, unrelated employer ✗ 403/404, guest ✗ 401, admin ✓
- [ ] **Concurrent duplicate apply test** — two parallel applies to the same job → exactly one 201, one 409
- [ ] **Deadline guard test** — apply to past-deadline job → 422
- [ ] Smoke script `scripts/smoke.sh`: register candidate → upload resume → search "react" → save job → apply → employer signs in → status change → candidate sees timeline + email logged
- [ ] RBAC smoke: CANDIDATE gets 403 on `/api/employer/*` + `/api/admin/*`; EMPLOYER gets 403 on `/api/admin/*` and other companies' applications
- [ ] Security review: signed-URL expiry honored, no public object access, sanitized HTML rendering, rate limits on register/apply/upload, ownership checks on every mutation

---

## Phase 13 — CI/CD, Deployment & Documentation

- [ ] GitHub Actions `.github/workflows/ci.yml` — on PR + main: install → lint → type-check → test → build
- [ ] Status badge in README; branch protection requiring green CI
- [ ] Optional: `Dockerfile` + `docker-compose.yml` (app + local Postgres) for containerized dev
- [ ] Push to GitHub; import to Vercel; set all env vars (rotate `NEXTAUTH_SECRET`, prod `STORAGE_PROVIDER` = `s3`)
- [ ] S3: private bucket policy (no public access), CORS for direct browser upload if used; Cloudinary: strict unsigned-upload disabled
- [ ] Resend: verify sending domain, update `EMAIL_FROM`
- [ ] Smoke-test production URL end-to-end (upload → apply → pipeline → email)
- [ ] README — 17-section template (Problem → Scaling Strategy), incl. architecture + ER diagrams, FTS deep-dive, pagination trade-off (offset vs cursor), signed-URL authz matrix
- [ ] `docs/architecture.svg` + `docs/ER-diagram.svg`; 30-second demo GIF (search → apply → employer pipeline → email)

---

## Done When

- [ ] All Phase 1–13 checkboxes ticked
- [ ] `npm run build`, `tsc --noEmit`, `eslint` all clean
- [ ] `npm test` green (incl. status-machine, authorization-matrix, and concurrent-apply tests)
- [ ] Deployed to Vercel, reachable at a public URL; resume upload/download verified against prod storage
- [ ] README links live demo + screenshots; GitHub repo public and CI green
