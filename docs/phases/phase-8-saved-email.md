# Phase 8 — Saved Jobs & Email Notifications

## Goals
1. Saved-jobs toggle + page (the last spec'd "advanced feature" before polish)
2. Transactional email via Resend with an `EmailLog` per send
3. Wire notifications into the Phase 7 transaction points — post-commit, never blocking

## Steps

### 8.1 Saved jobs
- `POST /api/saved-jobs/[jobId]` toggle or explicit `PUT`/`DELETE` — unique `(candidateId, jobId)` makes it idempotent (catch P2002 → 200 already-saved)
- `GET /api/saved-jobs?page` — saved jobs with job/company summary + savedAt
- Save button state on job detail (Phase 9) + `/account/saved` page

### 8.2 Email service (src/lib/email.ts)
```ts
export async function sendEmail(opts: {
  to: string; template: EmailTemplate; subject: string;
  data: Record<string, unknown>;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    await prisma.emailLog.create({ data: { ...opts, status: "SKIPPED" } });
    return;                                  // dev/test: never throw because mail isn't configured
  }
  try {
    await resend.emails.send({ from: process.env.EMAIL_FROM, to: opts.to,
      subject: opts.subject, html: renderTemplate(opts.template, opts.data) });
    await prisma.emailLog.create({ data: { ...opts, status: "SENT" } });
  } catch (e) {
    await prisma.emailLog.create({ data: { ...opts, status: "FAILED", meta: { error: String(e) } } });
    // logged, not rethrown — email must never break the API response
  }
}
```
- Templates (`src/lib/email/templates.ts`): simple HTML strings with an inline-styled layout + deep links — `welcome-candidate`, `welcome-employer`, `application-confirmation` (→ candidate), `application-received` (→ employer, links to pipeline), `application-status-changed` (→ candidate, shows `{jobTitle}` + new status)
- Every template renders escaped data (no raw HTML injection from names/titles)

### 8.3 Wire-in points (post-commit, fire-and-forget with logging)
| Event | To | Template |
|---|---|---|
| Signup | new user | welcome-candidate / welcome-employer |
| Apply (7.1, after tx) | candidate + company owner | application-confirmation / application-received |
| Status change (7.2, after tx) | candidate | application-status-changed |
- Send after the DB transaction commits; failures surface only in `EmailLog`

### 8.4 Tests
- Template rendering: variables interpolated, `<script>` in a job title/name is escaped
- Unconfigured env → `EmailLog` row with status SKIPPED, no throw
- (Mock resend) successful send → SENT row; rejected send → FAILED row, API still 200/201

## Done When
- Save/unsave toggles work and survive re-click (idempotent); `/account/saved` lists them
- Full happy path in dev: register → apply → employer status change → three `EmailLog` rows (SKIPPED or SENT) with correct templates/recipients
- With a real Resend key: candidate receives the status-change email with a working deep link
