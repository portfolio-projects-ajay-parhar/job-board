# Job Board Build — Progress Tracker

> Mirror of [`docs/TASKS.md`](./docs/TASKS.md). Tick boxes as each item completes. The "BUILD PASSING" line at the bottom is updated once `npm run build` runs clean.

## Status
**NOT STARTED** — planning complete (docs/PLAN.md + docs/TASKS.md + 13 phase files). Prerequisites: Supabase project, AWS S3 private bucket + Cloudinary keys, Resend key.

## Prerequisites
- [ ] Supabase project (pooled 6543 + direct 5432 connection strings)
- [ ] AWS account — IAM user + **private** S3 bucket for resumes (`s3-request-presigner`)
- [ ] Cloudinary account (raw/authenticated uploads) — `STORAGE_PROVIDER` picks the active backend
- [ ] Resend account — API key + verified sender domain
- [ ] Node.js ≥ 18, `gh` CLI authenticated

## Phase 1 — Setup & Database
- [x] Next.js scaffold (Next 16, TS, Tailwind v4, src dir)
- [x] Dependencies installed (Prisma 6, NextAuth v4, TanStack Query, Zod, Resend, sanitize-html, AWS S3 + presigner, Cloudinary, Vitest, …)
- [x] `.env.local` + `.env.example` (all storage/email vars) — local dev uses Docker Postgres (`jobboard-db` container)
- [x] Prisma schema + `init` migration (User w/ `CANDIDATE|EMPLOYER|ADMIN`, CandidateProfile, Company, Job + enums, Resume, Application, ApplicationEvent, SavedJob, EmailLog; all PLAN.md indexes)
- [x] **Raw-SQL FTS migration** — `searchVector` generated tsvector (title A / description B / location C) + GIN index; `pg_trgm` extension + trigram GIN on `Job.title` (column also declared `Unsupported("tsvector")` in schema to prevent drift-drops)
- [x] Singleton Prisma client
- [x] Seed: 1 ADMIN, 6 EMPLOYERs (1 unverified company), 8 CANDIDATEs, 6 companies, 36 jobs (2 DRAFT, 3 CLOSED, 4 featured, deadline edge cases), dummy-PDF resumes, applications across all statuses + event history, saved jobs
- [x] `next.config.ts` image config + base layout + `src/lib/salary.ts` (+ 12 passing Vitest tests for salary helpers)

## Phase 2 — Auth & Roles
- [ ] NextAuth options + handler (Credentials + Prisma adapter + JWT)
- [ ] JWT/session callbacks (`id`/`role`) + type augmentation
- [ ] Register API (role param; EMPLOYER signup creates `Company` in one transaction; 409; rate-limited)
- [ ] Guards: `requireUser/requireRole/requireCandidate/requireEmployer/requireAdmin/requireCompanyOwner/requireApplicationParticipant`
- [ ] Providers (Session, Query, Toast)
- [ ] Sign-in / sign-up pages (role toggle with company-name field)
- [ ] Role-aware header + server-side role checks in `(candidate)`, `(employer)`, `(admin)` layouts

## Phase 3 — Storage Layer & Company Profiles
- [ ] Pluggable storage: `upload / getDownloadUrl(key, ttl) / delete` behind `getStorage()` — s3 (private + presigned), cloudinary (raw, signed), local (dev/test)
- [ ] `POST /api/media` — logos only (MIME + magic bytes, 2 MB)
- [ ] Company profile APIs (`/api/employer/company`, public `/api/companies` + `[slug]`)
- [ ] Company profile editor page with logo upload
- [ ] Unit tests: storage factory by env, non-image rejection

## Phase 4 — Job CRUD & Publishing
- [ ] `POST /api/employer/jobs` (zod, unique slug, sanitized rich text, salary in cents, DRAFT/PUBLISHED)
- [ ] `PATCH` edit + `PATCH /status` job status machine (DRAFT→PUBLISHED→CLOSED→reopen, ARCHIVED terminal)
- [ ] `DELETE` soft-archive only (applications preserved)
- [ ] Public `GET /api/jobs/[slug]` (visibility rules, view count)
- [ ] Employer jobs table + new/edit job form

## Phase 5 — Candidate Profiles & Resume Uploads
- [ ] Candidate profile API + editor (skills array, URL validation)
- [ ] `POST /api/resumes` — PDF/DOCX MIME + extension + **magic-byte sniff** + 5 MB; server-generated key; `isPrimary` handling
- [ ] Resume list/delete (409 when referenced by an application) + download route with owner authorization → signed URL
- [ ] Resume manager UI
- [ ] Unit tests: magic-byte/MIME/size validation, primary-resume logic

## Phase 6 — Full-Text Search, Filters & Pagination
- [ ] Search query builder over `searchVector` (`websearch_to_tsquery`, `ts_rank` weighting, `ts_headline` snippets) + trigram fallback for partial words
- [ ] Filters: type, locationType, experienceLevel, category, salary range (normalized to cents), remote, postedWithin
- [ ] Sorts: `relevant` (default with q) | `newest` | `salary_desc`
- [ ] **Offset pagination** (`LIMIT/OFFSET`, total via `COUNT(*) OVER()`)
- [ ] Public `GET /api/jobs` (PUBLISHED only) + shareable URL params on `/jobs`
- [ ] Unit tests: SQL composition per filter combo, salary normalization, pagination math

## Phase 7 — Applications & Hiring Pipeline
- [ ] `POST /api/jobs/[id]/apply` — guards (PUBLISHED, deadline not passed, resume ownership) + unique (jobId, candidateId) 409; Application + first ApplicationEvent in one transaction
- [ ] Application status machine: `SUBMITTED→IN_REVIEW→INTERVIEW→OFFER→HIRED`; REJECTED from non-terminal; WITHDRAWN by candidate; terminal: HIRED/REJECTED/WITHDRAWN
- [ ] Employer status-change PATCH (422 on illegal) + ApplicationEvent (from→to, actor, note) in one transaction
- [ ] Employer applications lists (per-job + cross-job, status filter, offset pagination)
- [ ] Candidate withdraw route
- [ ] Employer resume-download authorization via Application linkage
- [ ] Unit tests: status machine, concurrent duplicate apply (409)

## Phase 8 — Saved Jobs & Email Notifications
- [ ] Saved-jobs toggle APIs (idempotent via unique constraint) + saved-jobs page
- [ ] Email service (Resend) + EmailLog per send; graceful SKIPPED when unconfigured
- [ ] Templates: welcome, application-received (→ employer), application-confirmation (→ candidate), application-status-changed (→ candidate)
- [ ] Sends wired post-commit into apply + status-change paths (never block the response)
- [ ] Unit tests: template rendering, EmailLog statuses

## Phase 9 — Storefront Pages
- [ ] Public layout + navbar + footer
- [ ] Home (hero search, featured rail, category tiles with counts, recent jobs, verified companies)
- [ ] `/jobs` — search, filter sidebar, sort, **pagination with totals**, empty/loading states
- [ ] `/jobs/[slug]` — sanitized sections, salary, company card, apply CTA states, save button, related jobs, `generateMetadata` + **JSON-LD `JobPosting`**, view count
- [ ] `/companies` + `/companies/[slug]`
- [ ] SEO: sitemap, robots, OG metadata
- [ ] `loading.tsx` skeletons on every public segment

## Phase 10 — Candidate & Employer Dashboards
- [ ] `/account/profile` (profile form + resume manager) · `/account/applications` (status timeline from ApplicationEvents) · `/account/saved`
- [ ] `/employer` KPIs (active jobs, total/new applications, per-job funnel counts) · `/employer/jobs` (status actions) · `/employer/jobs/[id]/applications` (pipeline view, detail drawer, machine-legal status buttons + note)
- [ ] Optimistic updates + toasts on all mutations

## Phase 11 — Admin Panel & Moderation
- [ ] `(admin)` layout with `requireAdmin()` server guard
- [ ] `/admin` platform KPIs (users/companies/jobs/applications by status, 30-day series chart)
- [ ] `/admin/companies` verify/unverify · `/admin/jobs` feature/close · `/admin/users` list
- [ ] RBAC: every `/api/admin/*` rejects non-admins (403)

## Phase 12 — Testing & Security
- [ ] Vitest unit suite (status machines, file validation, search SQL composition + salary normalization, storage factory + signed-URL TTL, email templates, slug helper)
- [ ] **Download authorization matrix test** (owner ✓ / applied-job employer ✓ / unrelated employer ✗ / guest ✗ / admin ✓)
- [ ] Concurrent duplicate apply test (one 201, one 409) + deadline guard test (422)
- [ ] Smoke script: register → upload resume → search → save → apply → employer status change → candidate timeline + email logged
- [ ] RBAC smoke + security review (signed-URL expiry, no public object access, sanitization, rate limits, ownership checks)

## Phase 13 — CI/CD, Deploy & Documentation
- [ ] GitHub Actions CI (install → lint → type-check → test → build) + badge + branch protection
- [ ] (Optional) Dockerfile + docker-compose
- [ ] GitHub push + Vercel deploy with all env vars (prod storage = `s3`)
- [ ] S3 private bucket policy (no public access) / Cloudinary hardened; Resend domain verified
- [ ] Production smoke (upload → apply → pipeline → email)
- [ ] README 17-section template (FTS deep-dive, pagination trade-off, signed-URL authz matrix) + architecture/ER diagrams + demo GIF

---

**Status: NOT STARTED** — planning artifacts complete. Update to **BUILD PASSING** once `next build`, `tsc --noEmit`, ESLint, and the test suite are all green.