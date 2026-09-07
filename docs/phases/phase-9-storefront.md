# Phase 9 — Storefront Pages

## Goals
1. Public experience: home, search, job detail, company pages — server-rendered and SEO-serious
2. **JSON-LD `JobPosting` structured data** (Google Jobs eligibility) — the SEO signature feature of a job board
3. Sitemap + robots + per-page metadata

## Steps

### 9.1 Layout & navigation
- `(public)` layout: navbar (logo, Jobs, Companies, search box, role-aware account menu from Phase 2), footer
- Shared card components: `JobCard` (title, company + verified badge, salary via `formatSalary`, type/level/remote chips, posted-ago), `CompanyCard`, `Pagination` (page numbers + totals)

### 9.2 Home (`/`)
- Hero: search input + popular category chips (deep links to `/jobs?category=…`)
- Featured rail (`featured: true`, PUBLISHED), recent jobs, top verified companies (job counts), category tiles with counts
- All server components hitting the Phase 4/6 APIs or direct Prisma reads

### 9.3 Search page (`/jobs`)
- Server component driven by `searchParams`; Suspense streams the results grid
- Filter sidebar: type checkboxes, location type, experience level, category select, salary range inputs, remote toggle, posted-within radio; sort dropdown; **active-filter chips** with clear-all
- Debounced q input (Phase 6 behavior, now styled)
- Pagination: numbered links preserving all params; "673 results · Page 2 of 34" summary line
- Empty state (clear-filters CTA), loading skeletons, error boundary

### 9.4 Job detail (`/jobs/[slug]`)
- Title block: company (logo, verified), location/type/level chips, salary, posted-ago, deadline warning
- Sanitized description/responsibilities/requirements/benefits sections (`sanitize-html` at render too — belt and braces)
- Right rail: apply card with state machine —
  - guest → "Sign in to apply"; candidate → Apply (opens cover letter + resume picker modal → Phase 7 API); already applied → "Applied ✓ (status)"; closed/deadline-passed → disabled with reason; employer/admin → no apply card
- Save toggle (Phase 8), share links, company card (other open roles), related jobs (same category, FTS or category query)
- `generateMetadata` (title = "Job title at Company"), OpenGraph image
- **JSON-LD**:
  ```json
  { "@context": "https://schema.org", "@type": "JobPosting",
    "title", "datePosted", "validThrough" (deadline), "employmentType",
    "hiringOrganization": { "@type": "Organization", "name", "logo", "sameAs": website },
    "jobLocationType": "TELECOMMUTE" (when REMOTE),
    "jobLocation" (ONSITE/HYBRID), "baseSalary": { "@type": "MonetaryAmount", "value": { min, max, "unitText": "YEAR" } } }
  ```
  Render via `<script type="application/ld+json" dangerouslySetInnerHTML>` from validated server data only

### 9.5 Company pages
- `/companies` — directory: search, cards with logo/industry/size/verified/open-roles count, pagination
- `/companies/[slug]` — profile (logo, description, size, website) + open roles list; `generateMetadata`

### 9.6 SEO plumbing
- `src/app/sitemap.ts` — static routes + all PUBLISHED job slugs + company slugs
- `src/app/robots.ts` — allow public, disallow `/account`, `/employer`, `/admin`, `/api`
- View count already ticking from Phase 4; no other instrumentation yet

## Done When
- Full guest journey: home → search "react remote" with filters → job detail → company page → back via breadcrumbs; shareable filtered URLs
- Job detail shows correct apply-card state for guest / candidate / applied candidate / employer
- Page source contains valid JSON-LD (test with Google Rich Results check on prod URL in Phase 13)
- `/sitemap.xml` and `/robots.txt` respond correctly; no authed route in the sitemap
