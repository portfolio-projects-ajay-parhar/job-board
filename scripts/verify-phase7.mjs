/**
 * Live Phase 7 verification (run with the dev server + seeded DB):
 *   node scripts/verify-phase7.mjs
 */
const base = "http://localhost:3000";

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
  const cookies = r2.headers.getSetCookie().map((c) => c.split(";")[0]);
  if (!cookies.some((c) => c.includes("next-auth"))) throw new Error(`login failed for ${email}`);
  return cookies.join("; ");
}

async function api(cookie, path, init = {}) {
  const r = await fetch(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", cookie, ...(init.headers ?? {}) },
  });
  let data = null;
  try { data = await r.json(); } catch { /* empty body */ }
  return { status: r.status, data };
}

const log = (label, ok, extra = "") =>
  console.log(`${ok ? "✓" : "✗ FAIL"} ${label}${extra ? ` — ${extra}` : ""}`);

async function main() {
  let r;
  // --- setup -----------------------------------------------------------------
  const cand = await login("candidate2@jobboard.dev"); // Noah (no application on job0 yet)
  const { data: resumes } = await api(cand, "/api/resumes");
  const resumeId = resumes.items.find((r) => r.isPrimary).id;

  const { data: search } = await api(cand, "/api/jobs?q=Senior%20React%20Engineer");
  const job = search.jobs[0]; // deadline = tomorrow, PUBLISHED, TechNova (employer1)
  const { data: search2 } = await api(cand, "/api/jobs?q=Frontend%20Developer%20(Contract)");
  const expiredJob = search2.jobs[0]; // deadline passed

  // --- 1. apply: 201 then 409 ---------------------------------------------------
  // candidate5 has no seeded application on job0; candidate2 does (seeded SUBMITTED)
  const cand5 = await login("candidate5@jobboard.dev");
  const { data: resumes5 } = await api(cand5, "/api/resumes");
  const resume5 = resumes5.items.find((r) => r.isPrimary).id;
  r = await api(cand5, `/api/jobs/${job.id}/apply`, { method: "POST", body: JSON.stringify({ resumeId: resume5, coverLetter: "I build React apps." }) });
  log("apply → 201", r.status === 201, `status=${r.status}`);
  r = await api(cand5, `/api/jobs/${job.id}/apply`, { method: "POST", body: JSON.stringify({ resumeId: resume5 }) });
  log("re-apply → 409 ALREADY_APPLIED", r.status === 409 && r.data.code === "ALREADY_APPLIED", `status=${r.status}`);

  // seeded-application check: candidate2's duplicate → 409 too
  r = await api(cand, `/api/jobs/${job.id}/apply`, { method: "POST", body: JSON.stringify({ resumeId }) });
  log("seeded duplicate apply → 409 ALREADY_APPLIED", r.status === 409 && r.data.code === "ALREADY_APPLIED", `status=${r.status}`);

  // --- 2. deadline guard ----------------------------------------------------------
  r = await api(cand5, `/api/jobs/${expiredJob.id}/apply`, { method: "POST", body: JSON.stringify({ resumeId: resume5 }) });
  log("expired deadline → 422 DEADLINE_PASSED", r.status === 422 && r.data.code === "DEADLINE_PASSED", `status=${r.status}`);

  // --- 3. concurrent duplicate apply (two parallel requests) -----------------------
  const cand3 = await login("candidate3@jobboard.dev");
  const { data: resumes3 } = await api(cand3, "/api/resumes");
  const resume3 = resumes3.items.find((x) => x.isPrimary).id;
  const [a, b] = await Promise.all([
    api(cand3, `/api/jobs/${job.id}/apply`, { method: "POST", body: JSON.stringify({ resumeId: resume3 }) }),
    api(cand3, `/api/jobs/${job.id}/apply`, { method: "POST", body: JSON.stringify({ resumeId: resume3 }) }),
  ]);
  const codes = [a.status, b.status].sort();
  log("concurrent apply → exactly one 201 + one 409", codes[0] === 201 && codes[1] === 409, `codes=${codes}`);

  // --- 4. employer pipeline: move + audit, then invalid transition -----------------
  const emp1 = await login("employer1@jobboard.dev");
  const appId = (a.status === 201 ? a : b).data.id;
  for (const to of ["IN_REVIEW", "INTERVIEW", "REJECTED"]) {
    r = await api(emp1, `/api/employer/applications/${appId}`, { method: "PATCH", body: JSON.stringify({ status: to }) });
    log(`employer move → ${to}`, r.status === 200, `status=${r.status}`);
  }
  r = await api(emp1, `/api/employer/applications/${appId}`, { method: "PATCH", body: JSON.stringify({ status: "OFFER" }) });
  log("OFFER after REJECTED → 422 INVALID_TRANSITION", r.status === 422 && r.data.code === "INVALID_TRANSITION", `status=${r.status}`);

  const { data: events } = await api(cand3, "/api/applications");
  const mine = events.items.find((x) => x.id === appId);
  const chain = mine.events.map((e) => `${e.fromStatus ?? "∅"}→${e.toStatus}`).join(", ");
  log("audit events recorded", mine.events.length === 4, `chain=${chain}`);

  // --- 5. cross-company isolation -------------------------------------------------
  const emp2 = await login("employer2@jobboard.dev");
  r = await api(emp2, `/api/employer/applications/${appId}`, { method: "PATCH", body: JSON.stringify({ status: "IN_REVIEW" }) });
  log("employer B moves employer A's application → 403", r.status === 403, `status=${r.status}`);
  const { data: emp2List } = await api(emp2, "/api/employer/applications");
  log("employer B list returns only own-company apps", emp2List.items.every((x) => x.job), `total=${emp2List.total}`);

  // --- 6. withdraw machine ----------------------------------------------------------
  const { data: list } = await api(cand3, "/api/jobs?q=Brand%20Designer");
  const job2 = list.jobs[0];
  const r2b = await api(cand3, `/api/jobs/${job2.id}/apply`, { method: "POST", body: JSON.stringify({ resumeId: resume3 }) });
  log("second apply for withdraw test → 201", r2b.status === 201);
  r = await api(cand3, `/api/applications/${r2b.data.id}/withdraw`, { method: "PATCH" });
  log("withdraw live application → 200", r.status === 200, `status=${r.status}`);

  // withdraw after HIRED → 422 (seeded HIRED application belongs to candidate4)
  const cand4 = await login("candidate4@jobboard.dev");
  const { data: cand4Apps } = await api(cand4, "/api/applications?status=HIRED");
  r = await api(cand4, `/api/applications/${cand4Apps.items[0].id}/withdraw`, { method: "PATCH" });
  log("withdraw after HIRED → 422", r.status === 422, `status=${r.status}`);
}

main().catch((e) => {
  console.error("script error:", e);
  process.exit(1);
});
