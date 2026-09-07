# Phase 13 — CI/CD, Deployment & Documentation

## Goals
1. GitHub Actions pipeline from day one (lint → type-check → test → build)
2. Production deploy on Vercel with private S3 storage + verified Resend domain
3. Portfolio-grade README (17 sections) + diagrams + demo GIF

## Steps

### 13.1 CI — .github/workflows/ci.yml
- On PR + push to main: `npm ci` → `lint` → `type-check` → `test` → `build`
- Build needs `DATABASE_URL` — use a dummy/direct URL + `prisma generate` in CI (no real DB required for type-level build), or a Supabase branch/CI secret if integration is wanted
- Status badge in README; protect `main` on green CI

### 13.2 Optional Docker
- `Dockerfile` (multi-stage, standalone Next output) + `docker-compose.yml` (app + local postgres) — dev convenience + a Docker talking point

### 13.3 Deploy (Vercel)
- Push repo to GitHub → import to Vercel → env vars (rotate `NEXTAUTH_SECRET`, `NEXTAUTH_URL` = prod domain, `STORAGE_PROVIDER=s3`, prod S3 keys, Resend key + domain)
- S3: private bucket (Block Public Access all-on), IAM key scoped to that bucket only
- Resend: verify sending domain; update `EMAIL_FROM`
- Smoke the prod URL: register → upload resume → apply → employer pipeline → signed download → email received; JSON-LD through Rich Results test; `/sitemap.xml` live

### 13.4 README (17-section template)
1. Problem · 2. Features (by role) · 3. Tech Stack · 4. Architecture (diagram) · 5. Database Schema (ER diagram) · 6. API Documentation (the PLAN table) · 7. Authentication Strategy (JWT + 3-role RBAC) · 8. **Security Considerations** (resume privacy: private storage, signed URLs, authorization matrix, magic bytes) · 9. Testing Strategy (status machines, authz matrix, concurrency) · 10. **Performance Considerations** (GIN/trigram indexes, EXPLAIN evidence, offset-vs-cursor trade-off) · 11. Deployment Architecture · 12. Screenshots · 13. Demo · 14. What I Learned · 15. Future Improvements (job alerts digests, employer teams/invites, Meilisearch upgrade path, Redis caching, rate-limit upgrade)
- Hero images: `docs/architecture.svg` + `docs/ER-diagram.svg`
- Two deep-dive callouts (differentiators vs Project 7): **Postgres FTS** (generated tsvector, weighting, ranking, trigram) and **confidential file pipeline** (upload validation → private storage → authz → signed URL)

### 13.5 Portfolio assets
- `docs/architecture.svg` — roles → routes → API → storage/email/DB
- `docs/ER-diagram.svg` — 11 models
- 30-second demo GIF: search "react remote" → open job → apply with resume → employer pipeline status change → candidate timeline + email log
- Trade-offs table: offset vs cursor pagination; tsvector vs external search engine; S3 vs Cloudinary for documents; block-deletion vs soft-delete for attached resumes

## Done When
- CI green on GitHub; Vercel deployment reachable at a public URL
- End-to-end prod smoke passed (upload → apply → pipeline → email → signed download)
- README complete with diagrams, badge, and live-demo link
- Final status line flipped in `docs/TASKS.md` ("BUILD PASSING")
