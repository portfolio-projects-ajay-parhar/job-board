# Phase 4 — Job CRUD & Publishing

## Goals
1. Employer-side job creation and editing with a **job status machine** (DRAFT → PUBLISHED → CLOSED, ARCHIVED terminal)
2. Public job-detail API with slug lookup, draft protection, and view counting
3. Sanitized rich text — job descriptions are the first user-supplied HTML in this project

## Steps

### 4.1 Job creation — POST /api/employer/jobs
```ts
const jobSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(50),            // rich text HTML
  responsibilities: z.string().optional(),
  requirements: z.string().optional(),
  benefits: z.string().optional(),
  type: z.nativeEnum(JobType),
  locationType: z.nativeEnum(LocationType),
  location: z.string().max(120).optional(),   // required when ONSITE/HYBRID
  country: z.string().max(80).optional(),
  category: z.nativeEnum(Category),
  experienceLevel: z.nativeEnum(ExperienceLevel),
  salaryMinCents: z.number().int().positive().optional(),
  salaryMaxCents: z.number().int().positive().optional(),
  salaryPeriod: z.nativeEnum(SalaryPeriod),
  applicationDeadline: z.coerce.date().optional(),
  publish: z.boolean().default(false),        // DRAFT vs PUBLISHED on create
}).refine(d => ONSITE_LIKE.has(d.locationType) ? !!d.location : true,
          { message: "Location required for onsite/hybrid" });
```
- `requireEmployer()` + company from session
- `slugify(title)` + uniqueness suffix (`-2`, `-3`…) on collision
- `sanitize-html` on every rich-text field (Project 6 pipeline: limited tags/attributes, no scripts/styles/iframes)
- Salary sanity: `salaryMinCents <= salaryMaxCents` (422 otherwise)
- `publish: true` → `status: PUBLISHED`, `publishedAt: now`

### 4.2 Edit + status machine — PATCH /api/employer/jobs/[id] (and /status)
- `requireCompanyOwner(jobId)`
- Editable while DRAFT or PUBLISHED (CLOSED must reopen first)
- Status machine (server-side helper `src/lib/job-status.ts`):
  ```text
  DRAFT → PUBLISHED            (sets publishedAt)
  PUBLISHED → CLOSED           (sets closesAt)
  CLOSED → PUBLISHED           (reopen — allowed)
  any → ARCHIVED               (terminal soft-delete)
  Invalid transition → 422 INVALID_TRANSITION with current status
  ```
- `DELETE` = archive (soft) — applications and application history are never destroyed

### 4.3 Public job APIs
- `GET /api/jobs/[slug]` — job + company (name, slug, logo, isVerified) + `viewCount`
  - DRAFT: 404 unless requester is the owning employer or ADMIN
  - CLOSED: still viewable (badged), but not applicable
  - Increment `viewCount` on successful public fetch (fire-and-forget update; dedupe not required)
- Full-text **search endpoint comes in Phase 6** — this phase's list API is only the employer's own table

### 4.4 Employer UI
- `/employer/jobs` — own jobs table: status badges, view counts, application counts, status action buttons (machine-legal ones only)
- `/employer/jobs/new` + `/employer/jobs/[id]/edit` — sectioned form: basics → description (rich-text editor) → compensation (cents inputs via `parseSalaryToCents` + period select) → deadline → publish control

## Done When
- Create → draft appears in employer table; publish → publicly visible at `/api/jobs/[slug]`
- Second job with the same title gets `-2` slug, not a 500
- DRAFT job: public visitor gets 404, owner gets 200
- Illegal transition (DRAFT → CLOSED) → 422; employer B editing employer A's job → 403
- Description containing `<script>` renders inert (sanitized on write)
