# Phase 5 — Candidate Profiles & Resume Uploads

## Goals
1. Candidate profile CRUD (skills, links, bio)
2. The project's security centerpiece: **validated, private resume uploads** with server-generated keys
3. Signed-URL downloads behind the ownership check
4. Referential-integrity rule: a resume attached to an application cannot be deleted

## Steps

### 5.1 Candidate profile — GET/PATCH /api/profile
- `requireCandidate()`
- PATCH: fullName, headline, location, phone, bio, `skills: string[]` (trim, dedupe, max 20), portfolioUrl/githubUrl/linkedinUrl (URL-validated)
- `/account/profile` form (profile section; resume manager in 5.3)

### 5.2 Resume upload — POST /api/resumes
`requireCandidate()`, rate-limited. Validation pipeline (order matters — cheap checks first):

```ts
const ALLOWED = new Map([
  ["application/pdf", { ext: "pdf", magic: [0x25, 0x50, 0x44, 0x46] }],        // %PDF-
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document",
   { ext: "docx", magic: [0x50, 0x4B, 0x03, 0x04] }],                          // PK.. (zip)
]);
// 1. declared MIME in allowlist        → else 415
// 2. sizeBytes <= 5 MB                 → else 413
// 3. first 4 bytes === magic bytes     → else 415 (catches renamed .exe → .pdf)
// 4. key = `resumes/${candidateId}/${uuidv4()}.${ext}`  — client filename NEVER in the key
```
- `storage.upload(key, buffer, mime)` → create `Resume` row (fileName sanitized for display, provider recorded)
- `isPrimary`: first upload becomes primary; an explicit `makePrimary` flag demotes the previous primary in the same transaction
- Cap: max 5 active resumes per candidate (409 with message to delete one)

### 5.3 Resume management — GET/DELETE /api/resumes, GET /api/resumes/[id]/download
- GET: own rows (fileName, size, isPrimary, uploadedAt, appliedCount)
- DELETE: owner check → `prisma.application.count({ where: { resumeId } })` > 0 → **409** (`RESUME_IN_USE`, includes count); else `storage.delete(key)` + delete row (delete object first; DB row only on storage success — or accept orphan with cleanup note)
- Download: authorization matrix —
  | Requester | Allowed? |
  |---|---|
  | Resume owner (candidate) | ✓ |
  | EMPLOYER whose company owns a Job having an `Application` referencing this resume | ✓ |
  | ADMIN | ✓ |
  | Anyone else (incl. other candidates, other employers) | 404 (don't leak existence) |
- On pass: `302` → `storage.getDownloadUrl(key, 120)` — never stream through the app server in prod, never mint a public URL

### 5.4 UI — resume manager (part of /account/profile)
- Dropzone → upload with progress; list with size/date/primary star; delete with confirm (shows 409 state as "in use by N applications")
- PDF preview (first page) via the signed URL in a new tab — proves the authorization flow works end-to-end

### 5.5 Tests
- Magic-byte validation: PDF renamed from `.txt` rejected; DOCX (zip header) accepted; empty file rejected
- Size limit boundary (5 MB + 1 byte → 413)
- Key generation: no client filename, UUID, candidate-scoped prefix
- Authorization matrix basics (full matrix in Phase 12)

## Done When
- Upload → list → preview → delete round-trips against the configured provider
- Switching `STORAGE_PROVIDER` changes nothing in route code
- Deleting a resume referenced by a seeded application → 409
- Requesting another candidate's resume by id → 404, even signed in
