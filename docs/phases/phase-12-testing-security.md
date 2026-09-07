# Phase 12 — Testing & Security

## Goals
1. Vitest unit suites for every pure decision-maker in the app
2. The three signature reliability tests: **authorization matrix**, **concurrent duplicate apply**, **deadline guard**
3. End-to-end smoke script + RBAC smoke
4. A written security review against the invariant list

## Steps

### 12.1 Unit suites (Vitest)
- `application-status.ts` — full 7×7 transition table; `legalNext()` matches the table
- `job-status.ts` — DRAFT→PUBLISHED→CLOSED→(PUBLISHED)→ARCHIVED; illegal jumps 422
- Resume validation — magic bytes (PDF ok, renamed txt no, DOCX zip header ok), 5 MB boundary, extension/MIME mismatch, key generation (UUID, candidate-scoped, no client filename)
- `search.ts` — SQL + params for every filter combination; salary normalization across periods; pagination math; q never appears in the SQL text un-parameterized
- `salary.ts` — format/parse/normalize
- Email templates — interpolation + escaping (`<script>` in names/titles); SKIPPED path when unconfigured
- Slug helper — collision suffixing

### 12.2 Signature tests
- **Download authorization matrix** (parametrized):
  | Requester | Expected |
  |---|---|
  | Resume owner | 302 → signed URL |
  | Employer of a job with a referencing Application | 302 |
  | Unrelated employer | 404 |
  | Other candidate | 404 |
  | Guest | 401 |
  | ADMIN | 302 |
  Also: signed URL TTL = 120s, provider switch honored
- **Concurrent duplicate apply** — Promise.all two applies, same candidate+job → {201, 409}; DB ends with one Application + one SUBMITTED ApplicationEvent
- **Deadline guard** — apply to seeded past-deadline job → 422; tomorrow-deadline job → 201
- **Withdraw-after-HIRED** → 422

### 12.3 Smoke script (scripts/smoke.sh)
Against a running dev server + seeded DB:
1. register candidate → 201
2. sign in → upload resume → 201
3. `GET /api/jobs?q=react` → ≥1 result
4. save a job → toggle idempotent
5. apply with resume id → 201; repeat → 409
6. sign in as that job's employer → list applications → status SUBMITTED→IN_REVIEW → 200
7. candidate tracker shows IN_REVIEW + timeline event
8. `EmailLog` has: confirmation, received, status-changed (SKIPPED ok)
9. RBAC: candidate token → `/api/employer/jobs` → 403; employer token → `/api/admin/stats` → 403; employer A → employer B's application → 403

### 12.4 Security review checklist (write results into README later)
- [ ] No public storage URLs; bucket Block-Public-Access on; Cloudinary unsigned uploads disabled
- [ ] Signed URLs ≤ 120s; expiry actually enforced by provider
- [ ] All raw SQL parameterized (grep for template-literal SQL with interpolation)
- [ ] Sanitize-on-write AND render for all HTML fields; cover letters plain text
- [ ] Rate limits on register / apply / resume upload / media
- [ ] Ownership guards on every mutating route (walk the API table row by row)
- [ ] No applicant PII (email, phone, resume) exposed cross-company or to guests
- [ ] Registration can never mint ADMIN
- [ ] Error responses don't leak stack traces / SQL

## Done When
- `npm test` fully green including the three signature tests
- Smoke script end-to-end passes against a fresh seeded DB
- Security checklist all checked with notes; any discovered issue fixed and regression-tested
