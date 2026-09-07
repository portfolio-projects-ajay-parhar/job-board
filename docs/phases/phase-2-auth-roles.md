# Phase 2 — Authentication & Roles

## Goals
1. NextAuth (Credentials + JWT) with a **three-role** session: `CANDIDATE | EMPLOYER | ADMIN`
2. Role-scoped signup — employer registration creates the company in the same transaction
3. Reusable guards + ownership checks that throw typed errors
4. Role-aware navigation and server-enforced route segments

## Steps

### 2.1 NextAuth options
- Credentials provider (email + password, bcrypt compare), Prisma adapter, `session.strategy: "jwt"`
- JWT + session callbacks copy `id` and `role` from the DB user onto token and session
- `src/types/next-auth.d.ts` — augment `Session.user` / `JWT` with `role: "CANDIDATE" | "EMPLOYER" | "ADMIN"`

### 2.2 Registration API
`POST /api/auth/register` (public, rate-limited):
```ts
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["CANDIDATE", "EMPLOYER"]),   // never accept ADMIN from input
  name: z.string().min(1),
  companyName: z.string().min(2).optional(), // required when role = EMPLOYER
}).refine(d => d.role !== "EMPLOYER" || !!d.companyName, { message: "Company name required" });
```
- EMPLOYER: `prisma.$transaction` — create `User` + `Company` (slugified unique name, `isVerified: false`)
- CANDIDATE: create `User` + empty `CandidateProfile`
- 409 on duplicate email; ADMINs only ever exist via seed/DB

### 2.3 Guards (src/lib/auth-guards.ts)
```ts
requireUser()                  // any signed-in user
requireRole(role)              // exact role
requireCandidate()             // role === CANDIDATE + CandidateProfile exists
requireEmployer()              // role === EMPLOYER + Company exists
requireAdmin()                 // role === ADMIN
requireCompanyOwner(jobOrCompanyId)   // EMPLOYER whose Company owns the resource
requireApplicationParticipant(applicationId)
// candidate owner, OR employer whose company owns the application's job, OR admin
```
All throw `AuthError` with a status (401/403/404); route handlers map it via one `handleApiError()` wrapper (Project 6/7 pattern).

### 2.4 Auth pages
- `/signup` — role toggle (Candidate | Employer); employer reveals the company-name field; Suspense-wrapped `useSearchParams` (redirect-back support)
- `/signin` — credentials form with callbackUrl handling
- Providers wrapper: Session, Query, Toast

### 2.5 Role-aware shell
- Header derives menu from `session.user.role`: candidate → Profile/Applications/Saved; employer → Dashboard/Company/Jobs; admin → Admin link
- Server-side enforcement (the real check): each layout calls its guard and `redirect()`s on mismatch — hiding UI alone is never the security boundary

## Done When
- Register as candidate → lands signed-in with candidate menu; register as employer → company row exists with `isVerified: false`
- `POST /api/auth/register` with `role: "ADMIN"` is rejected; duplicate email → 409
- Visiting `/employer`, `/account`, `/admin` while signed out redirects to `/signin?callbackUrl=…`; signed in with the wrong role → redirected away
- Rate limit test: 11th rapid register attempt → 429
