# Phase 10 — Candidate & Employer Dashboards

## Goals
1. Candidate workspace: profile + resume manager, application tracker with **audit-event timelines**, saved jobs
2. Employer workspace: dashboard KPIs, job table, and the **hiring pipeline UI** — the project's signature admin-style screen
3. Optimistic mutations + toasts everywhere

## Steps

### 10.1 Candidate — `/account/*`
- `profile` — profile form + resume manager (Phase 5 UI now polished: dropzone, primary star, in-use warning on delete)
- `applications` — tracker:
  - Grouped or tabbed by status (Active / Interviewing / Offers / Closed)
  - Each row: job title + company, applied-ago, status badge, applied resume name
  - Detail view: **status timeline from `ApplicationEvent`** (Submitted → In review → …, timestamps, employer notes where present)
  - Withdraw button (machine-legal states only; confirm dialog)
- `saved` — saved jobs list (unsave, apply, link to job)

### 10.2 Employer — `/employer`
- Dashboard `/employer`: active-jobs count, applications this week, per-job funnel table (SUBMITTED → IN_REVIEW → INTERVIEW → OFFER → HIRED counts), recent applications feed
- `/employer/jobs` — table with status filter + view/application counts + status action buttons (from Phase 4 machine)
- Job form polish: sectioned layout, live salary preview (`formatSalary`), deadline date picker, save-as-draft vs publish

### 10.3 Hiring pipeline — `/employer/jobs/[id]/applications`
- Columns (kanban-lite) or grouped list by status: SUBMITTED / IN_REVIEW / INTERVIEW / OFFER / HIRED / REJECTED
- Candidate card: name, headline, top skills, applied-ago, resume link (**signed download**, Phase 5 matrix)
- Detail drawer: cover letter (plain text), full skills list, resume download, status history
- Status-change buttons render **only machine-legal transitions** for the current status (`legalNext()`), plus optional note input on REJECTED/OFFER
- Mutations: TanStack Query optimistic update + invalidate on error; 422 `INVALID_TRANSITION` surfaces the current status
- Candidate email goes out server-side (Phase 8) — UI just shows "Candidate will be notified"

### 10.4 Cross-cutting
- Every mutation: optimistic update, error toast with server message, loading disabled states
- `loading.tsx` skeletons for dashboard segments; role-scoped layouts already guard server-side (Phase 2)
- Empty states with real CTAs (no applications yet → "Post your first job" / "Browse jobs")

## Done When
- Candidate journey: apply (Phase 7 API) → appears in tracker → employer moves status → timeline updates on refresh, withdraw works pre-HIRED
- Employer journey: dashboard → job → pipeline → move candidate through 3 stages with notes → resume downloads via signed URL
- Illegal transitions are impossible from the UI (buttons don't exist) **and** rejected by the API (Phase 7 tests)
- All mutations recover gracefully when the network fails (rollback + toast)
