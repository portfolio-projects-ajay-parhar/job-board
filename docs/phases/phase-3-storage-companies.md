# Phase 3 — Storage Layer & Company Profiles

## Goals
1. Build the **pluggable storage abstraction** — S3, Cloudinary, and a local dev provider behind one interface
2. Image upload route (company logos) with validation
3. Company profile CRUD for employers + public company APIs
4. Start the authorization habit: uploads and profile writes are ownership-checked from day one

## Steps

### 3.1 Storage abstraction (src/lib/storage/)
```ts
export interface StorageProvider {
  upload(key: string, body: Buffer, contentType: string): Promise<void>;
  getDownloadUrl(key: string, ttlSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}
export const getStorage = (): StorageProvider => {
  switch (process.env.STORAGE_PROVIDER) {
    case "s3":         return new S3Provider();
    case "cloudinary": return new CloudinaryProvider();
    default:           return new LocalProvider();   // dev/test — .uploads/ on disk
  }
};
```
- **S3Provider** — private bucket; `PutObjectCommand` for upload; `getSignedUrl(client, GetObjectCommand, { expiresIn: ttl })` for downloads; `DeleteObjectCommand`
- **CloudinaryProvider** — `upload` with `{ resource_type: "raw", type: "authenticated", public_id: key }`; downloads via signed delivery URL (`sign_url: true`, `type: "authenticated"`, expiry timestamp); `destroy` for delete
- **LocalProvider** — writes under `.uploads/<key>`, sanitizes the key (no `..`), download URL is an internal route that streams after the same server-side authorization (dev parity with the signed-URL flow)
- Keys are always server-generated; the client's filename is stored in DB for display only

### 3.2 Image upload route
`POST /api/media` (signed-in, rate-limited):
- multipart FormData → Buffer
- Validate: MIME allowlist (`image/png|jpeg|webp`) + **magic bytes** (`89 50 4E 47`, `FF D8 FF`, `RIFF…WEBP`) + ≤ 2 MB
- Key: `media/{userId}/{uuid}.{ext}` → `storage.upload` → return `{ url: downloadUrl, key }`
- Image URLs land in DB as regular fields (`Company.logoUrl`) — images may be public unlike resumes

### 3.3 Company APIs
- `GET/PATCH /api/employer/company` — `requireEmployer()`; PATCH validates: name, website (URL), description, location, industry, size enum, foundedYear, logoUrl (must be a key this user uploaded)
- `GET /api/companies` — public: `q` (ILIKE name), `page`, `pageSize`; include PUBLISHED job counts; verified badge field
- `GET /api/companies/[slug]` — profile + open (PUBLISHED) jobs summary

### 3.4 UI
- `/employer/company` — profile form (React Hook Form + zod resolver) with logo dropzone → `/api/media`
- Basic `/companies` + `/companies/[slug]` pages (full polish in Phase 9)

### 3.5 Tests
- Storage factory returns the right provider per env (mock env)
- Local provider round-trip: upload → download URL → content matches → delete
- Media validation rejects: text file named `.png`, oversized image, wrong magic bytes

## Done When
- Logo upload round-trips through the configured provider and renders on the company page
- `STORAGE_PROVIDER` switched between `local`/`s3`/`cloudinary` with **no code changes**
- Signed Cloudinary/S3 URLs expire; direct bucket URL is denied (private)
- PATCHing another employer's company → 403
