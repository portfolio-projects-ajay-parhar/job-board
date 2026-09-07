/**
 * End-to-end smoke test (Phase 12).
 * Prereqs: dev server running on :3000 + freshly seeded DB (`npm run db:seed`).
 * Run: node scripts/smoke.mjs
 */
const base = process.env.SMOKE_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;
const log = (ok, label, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${label}${extra ? ` — ${extra}` : ""}`);
  ok ? passed++ : failed++;
};

async function login(email) {
  const r = await fetch(`${base}/api/auth/csrf`);
  const cookie = r.headers.getSetCookie()[0].split(";")[0];
  const { csrfToken } = await r.json();
  const body = new URLSearchParams({ csrfToken, email, password: "Password123!", json: "true" });
  const r2 = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie },
    body,
    redirect: "manual",
  });
  return r2.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

async function api(ck, path, init = {}) {
  const r = await fetch(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", cookie: ck, ...(init.headers ?? {}) },
  });
  let data = null;
  try { data = await r.json(); } catch { /* empty */ }
  return { status: r.status, data };
}

async function main() {
  // 1. register candidate
  const email = `smoke-${Date.now()}@example.com`;
  const reg = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Smoke Candidate", email, password: "Password123!", role: "CANDIDATE" }),
  });
  log(reg.status === 201, "1. register candidate → 201", `status=${reg.status}`);

  // 2. sign in + upload resume
  const ck = await login(email);
  const fd = new FormData();
  fd.append("file", new Blob(["%PDF-1.4 smoke test"], { type: "application/pdf" }), "smoke.pdf");
  const up = await fetch(`${base}/api/resumes`, { method: "POST", headers: { cookie: ck }, body: fd });
  const resume = await up.json();
  log(up.status === 201 && resume.id, "2. sign in + upload resume → 201", `status=${up.status}`);

  // 3. search
  const { data: search } = await api(ck, "/api/jobs?q=react");
  log(search.total >= 1, "3. search q=react → ≥1 result", `total=${search.total}`);

  // 4. save job (idempotent)
  const job = search.jobs[0];
  const s1 = await api(ck, `/api/saved-jobs/${job.id}`, { method: "PUT" });
  const s2 = await api(ck, `/api/saved-jobs/${job.id}`, { method: "PUT" });
  log(s1.status === 201 && s2.status === 200 && s2.data.saved === true, "4. save job + idempotent re-save", `codes=${s1.status},${s2.status}`);

  // 5. apply + re-apply 409
  const a1 = await api(ck, `/api/jobs/${job.id}/apply`, { method: "POST", body: JSON.stringify({ resumeId: resume.id }) });
  const a2 = await api(ck, `/api/jobs/${job.id}/apply`, { method: "POST", body: JSON.stringify({ resumeId: resume.id }) });
  log(a1.status === 201 && a2.status === 409 && a2.data.code === "ALREADY_APPLIED", "5. apply → 201, repeat → 409", `codes=${a1.status},${a2.status}`);

  // 6. employer signs in, lists applications, moves status
  //    find the job's company owner email via the public company endpoint
  const { data: company } = await api(ck, `/api/companies/${job.companySlug}`);
  // owner email is not public — the smoke job is jobs[0] = Senior React Engineer (TechNova, seeded employer1)
  const emp = await login("employer1@jobboard.dev");
  const { data: apps } = await api(emp, `/api/employer/jobs/${job.id}/applications`);
  const mine = apps.items.find((x) => x.candidate.email === email);
  log(!!mine, "6a. employer sees the new application", mine ? mine.candidate.name : "not found");
  const mv = await api(emp, `/api/employer/applications/${a1.data.id}`, { method: "PATCH", body: JSON.stringify({ status: "IN_REVIEW" }) });
  log(mv.status === 200, "6b. employer moves SUBMITTED → IN_REVIEW", `status=${mv.status}`);

  // 7. candidate tracker shows IN_REVIEW + timeline
  const { data: tracker } = await api(ck, "/api/applications");
  const row = tracker.items.find((x) => x.id === a1.data.id);
  log(row.status === "IN_REVIEW" && row.events.length === 2, "7. tracker shows IN_REVIEW + 2 timeline events", `events=${row.events.length}`);

  // 8. RBAC
  const rb1 = await api(ck, "/api/employer/jobs");
  log(rb1.status === 403, "8a. candidate → /api/employer/jobs → 403", `status=${rb1.status}`);
  const rb2 = await api(emp, "/api/admin/stats");
  log(rb2.status === 403, "8b. employer → /api/admin/stats → 403", `status=${rb2.status}`);
  const emp2 = await login("employer2@jobboard.dev");
  const rb3 = await api(emp2, `/api/employer/applications/${a1.data.id}`, { method: "PATCH", body: JSON.stringify({ status: "OFFER" }) });
  log(rb3.status === 403, "8c. employer B → employer A's application → 403", `status=${rb3.status}`);
  const admin = await login("admin@jobboard.dev");
  const rb4 = await api(admin, "/api/admin/stats");
  log(rb4.status === 200, "8d. admin → /api/admin/stats → 200", `status=${rb4.status}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("smoke error:", e);
  process.exit(1);
});
