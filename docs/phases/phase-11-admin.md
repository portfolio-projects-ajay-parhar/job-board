# Phase 11 — Admin Panel & Moderation

## Goals
1. Platform overview with real aggregates
2. Moderation actions: verify companies, feature/close jobs — each with visible storefront effect
3. User directory; RBAC locked down server-side

## Steps

### 11.1 Layout & guard
- `(admin)` layout — `requireAdmin()` (server redirect), distinct nav: Overview / Companies / Jobs / Users

### 11.2 `/admin` — platform stats
- KPI cards: users by role, companies (verified/total), jobs (by status), applications (by status)
- 30-day series: signups + applications per day (`groupBy` on date-truncated `createdAt`) → simple chart
- Queries: Prisma `groupBy`/`count` — keep on the admin route only; no caching yet (Phase 13 notes it as future work)

### 11.3 `/admin/companies`
- Table: name, owner, jobs count, verified badge, joined
- Actions: **verify / unverify** (`PATCH /api/admin/companies/[id]`) — verification shows the verified badge on storefront cards (Phase 9 components read `isVerified`)

### 11.4 `/admin/jobs`
- Table: title, company, status, featured, views, applications count, published date
- Search (title/company) + status filter + pagination
- Actions: **feature / unfeature** (home rail), **close** any job (company notified via status-change email? — no: log-only for moderation, note it in the audit trail via `EmailLog` skip or a simple `admin-closed-job` email to the company owner — pick one and document it)

### 11.5 `/admin/users`
- Table: name/email, role badge, joined, activity counts (jobs posted | applications submitted)
- Read-only in this scope (role changes are seed/DB-managed — document why: destructive, out of MVP scope)

### 11.6 API hardening recap
- Every `/api/admin/*` route begins with `requireAdmin()` — no exceptions, no client-side-only checks
- Admin PATCHes validate enums and return 422 on junk (same zod discipline as employer routes)

## Done When
- Non-admin hitting `/admin` or any `/api/admin/*` → redirect / 403 (proven again by Phase 12 smoke)
- Verifying the seeded unverified company flips its storefront badge
- Featuring a job surfaces it in the home rail; closing one disables apply with reason
- KPI numbers match manually-run SQL counts on seeded data
