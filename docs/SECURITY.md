# Security Review — Job Board (Phase 12)

Reviewed against the invariant list in `docs/PLAN.md` and the Phase 12 checklist. Every item is backed by code, a test, or a live verification run.

| # | Check | Status | Notes / Evidence |
|---|---|---|---|
| 1 | No public storage URLs; private-by-construction resumes | ✅ | S3 provider uses a private bucket (Block Public Access ON per `.env.example` guidance, `ServerSideEncryption` on write); Cloudinary uses `type: "authenticated"` raw assets; local dev provider serves only via HMAC-signed internal links (`verifyLocalSignature`). No route streams objects without an authorization check or a valid signature. |
| 2 | Signed URLs ≤ 120s and expiry enforced | ✅ | `GET /api/resumes/[id]/download` mints `getDownloadUrl(key, 120)`. S3 presigner caps TTL; local links embed `expires` + HMAC, expiry verified in `tests/storage.test.ts` (tamper/expiry cases). |
| 3 | All raw SQL parameterized | ✅ | The only dynamic SQL is `src/lib/search.ts` — tested that `q` never appears in the SQL string (`tests/search.test.ts`, "never interpolates user input"). Admin 30-day series SQL is static. |
| 4 | Sanitize-on-write AND render; cover letters plain text | ✅ | `sanitizeRichText` on all job rich-text fields on write; `Section` re-sanitizes at render. Cover letters pass through `stripHtml` (regression test in `tests/email-templates.test.ts`). Email templates escape all interpolations. |
| 5 | Rate limits on register / apply / resume upload / media | ✅ | `register:` 10/min, `apply:` 20/min, `resumes:` 10/min, `media:` 20/min — in-memory fixed-window (`src/lib/rate-limit.ts`); 429 verified live. Note: per-instance limiter — swap for Redis at multi-instance scale. |
| 6 | Ownership guards on every mutating route | ✅ | `requireCandidate/requireEmployer/requireAdmin/requireCompanyOwner/requireApplicationParticipant` used across all PATCH/POST/DELETE routes; cross-company PATCH → 403 verified live (`scripts/smoke.mjs` step 8c). |
| 7 | No applicant PII exposed cross-company or to guests | ✅ | Employer pipeline APIs filter by `companyId`; resume download matrix 404s non-participants (existence not leaked); guest → 401; other candidate → 404. Verified live in Phase 5. |
| 8 | Registration can never mint ADMIN | ✅ | Zod schema `role: z.enum(["CANDIDATE", "EMPLOYER"])` — `role: "ADMIN"` rejected 400 (verified live in Phase 2). |
| 9 | Error responses don't leak stacks/SQL | ✅ | `handleApiError` maps typed errors to `{ error }`; unexpected errors log server-side only, return generic 500. |

## Known limitations (documented, acceptable for MVP scope)

- Rate limiter is per-process memory — move to Redis/Upstash before horizontal scaling.
- Cloudinary authenticated-asset delivery requires the account's token key configuration; the S3 path is the reference implementation for prod.
- `viewCount` increments fire-and-forget per request with no dedupe (by design in the spec).
- Admin job "close" intentionally bypasses the employer status machine as a moderation override (documented in `PATCH /api/admin/jobs/[id]`).
