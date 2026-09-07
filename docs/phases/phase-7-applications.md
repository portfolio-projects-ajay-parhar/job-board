# Phase 7 — Applications & Hiring Pipeline

## Goals
1. Apply flow with every guard: publish state, deadline, uniqueness, resume ownership
2. **Application status machine** — server-side, transition-validated, fully audited (`ApplicationEvent`)
3. Employer pipeline APIs (per-job and cross-job lists, status changes)
4. Candidate withdraw

## Steps

### 7.1 Apply — POST /api/jobs/[id]/apply
`requireCandidate()`, rate-limited. Guards in order:
1. Job exists and `status = 'PUBLISHED'` → else 404/409
2. `applicationDeadline` null or future → else 422 `DEADLINE_PASSED`
3. `resumeId` belongs to requester → else 403
4. Optional `coverLetter` (plain text, ≤ 5000 chars — **no HTML**)
5. Unique `(jobId, candidateId)` → catch P2002 → **409 `ALREADY_APPLIED`**

Then one transaction:
```ts
prisma.$transaction([
  application.create({ status: "SUBMITTED", submittedAt: now, lastStatusAt: now }),
  applicationEvent.create({ fromStatus: null, toStatus: "SUBMITTED", actorId: candidateId }),
]);
```
(Email hooks land in Phase 8 — structure the route so a notification step is one call after commit.)

### 7.2 Status machine (src/lib/application-status.ts)
```ts
const EMPLOYER_FLOW = ["SUBMITTED", "IN_REVIEW", "INTERVIEW", "OFFER", "HIRED"] as const;
const TERMINAL = new Set(["HIRED", "REJECTED", "WITHDRAWN"]);
const canTransition = (from: Status, to: Status): boolean => {
  if (TERMINAL.has(from)) return false;
  if (to === "REJECTED") return true;                       // any live stage → REJECTED
  if (from === "SUBMITTED" && to === "WITHDRAWN") return true;  // candidate withdraw (see 7.4)
  const i = EMPLOYER_FLOW.indexOf(from), j = EMPLOYER_FLOW.indexOf(to);
  return j === i + 1;                                        // strictly forward, no skips
};
export const legalNext = (from: Status): Status[] => /* all to-passing values, incl. REJECTED/WITHDRAWN per role */;
```
- `PATCH /api/employer/applications/[id]` — `requireCompanyOwner(application.jobId)`; body `{ status, note? }`; `canTransition` false → **422 `INVALID_TRANSITION`** (response includes current status)
- Valid → transaction: update `Application` (status, `lastStatusAt`, optional `employerNote`) + insert `ApplicationEvent` `{ fromStatus, toStatus, note?, actorId: employerId }`
- OFFER/HIRED/REJECTED events also stamp `note` availability in the timeline

### 7.3 Employer pipeline reads
- `GET /api/employer/jobs/[id]/applications?status&page` — `requireCompanyOwner`; offset pagination; include candidate summary (name, headline, skills top-5, resume id/fileName) — **full resume access only via the download route**
- `GET /api/employer/applications?status&jobId&page` — cross-job list for the dashboard
- Cross-company leak check: employer of job A requesting an application on job B → 403

### 7.4 Candidate side
- `PATCH /api/applications/[id]/withdraw` — owner; allowed from any live stage **except HIRED** (machine already encodes this)
- `GET /api/applications?page&status` — own tracker rows: job title/company/slug, status, submittedAt, applied resume fileName
- Detail: full `ApplicationEvent` timeline (from→to, note, createdAt) — rendered in Phase 10

### 7.5 Tests
- Status machine: **every** (from, to) pair asserted — 7×7 table, legal ones pass, everything else 422 (SUBMITTED→OFFER skip must fail; REJECTED from every live stage must pass; nothing leaves terminal states)
- Concurrent duplicate apply: two parallel `apply` calls → exactly one 201 + one 409 (P2002 handler proven under race)
- Deadline guard: past-deadline seeded job → 422; deadline-tomorrow job → 201
- Employer status change writes exactly one ApplicationEvent per call with the right actor

## Done When
- Seeded candidate applies to a seeded published job through the API with a resume id — 201; immediately again — 409
- Employer moves the application SUBMITTED → IN_REVIEW → INTERVIEW → REJECTED; each step audited
- Trying OFFER after REJECTED → 422; candidate withdraws a live application — works; withdraw after HIRED — 422
- Employer A cannot see or move employer B's applications (403)
