import { ApiError } from "./api-error";

/**
 * Upload validation — MIME allowlist + magic-byte sniffing + hard size limits.
 * Client-supplied filenames are display-only and never used as storage keys.
 */

const IMAGE_TYPES = {
  "image/png": { ext: "png", magic: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/jpeg": { ext: "jpg", magic: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/webp": { ext: "webp", magic: (b: Buffer) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
} as const;

const RESUME_TYPES = {
  "application/pdf": { ext: "pdf", magic: (b: Buffer) => b.subarray(0, 5).toString("ascii") === "%PDF-" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    ext: "docx",
    magic: (b: Buffer) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04, // PK\x03\x04
  },
} as const;

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB

type Sniff = { ext: string };

function validate(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  allowlist: Record<string, { ext: string; magic: (b: Buffer) => boolean }>,
  maxBytes: number,
  label: string,
): Sniff {
  if (buffer.length === 0) throw new ApiError(400, `${label} is empty`);
  if (buffer.length > maxBytes) {
    throw new ApiError(400, `${label} exceeds the ${Math.round(maxBytes / 1024 / 1024)} MB limit`);
  }
  const entry = allowlist[mimeType];
  if (!entry) throw new ApiError(400, `Unsupported ${label} type: ${mimeType || "unknown"}`);
  // Magic bytes must agree with the declared MIME type (anti-spoofing)
  if (!entry.magic(buffer)) throw new ApiError(400, `File content does not match its declared type`);
  // Extension is display-only, but flag a mismatch early
  const declaredExt = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  if (declaredExt && declaredExt !== entry.ext && !(entry.ext === "jpg" && declaredExt === "jpeg")) {
    throw new ApiError(400, `File extension ".${declaredExt}" does not match its content`);
  }
  return { ext: entry.ext };
}

/** Images (company logos). Returns the canonical extension for the key. */
export function validateImageUpload(buffer: Buffer, mimeType: string, fileName: string): Sniff {
  return validate(buffer, mimeType, fileName, IMAGE_TYPES, MAX_IMAGE_BYTES, "image");
}

/** Resumes (PDF/DOCX). Returns the canonical extension for the key. */
export function validateResumeUpload(buffer: Buffer, mimeType: string, fileName: string): Sniff {
  return validate(buffer, mimeType, fileName, RESUME_TYPES, MAX_RESUME_BYTES, "resume");
}

/** Display-only filename sanitization (strip path segments + control chars). */
export function sanitizeFileName(name: string): string {
  return name.split(/[/\\]/).pop()!.replace(/[\x00-\x1f<>:"|?*]/g, "_").slice(0, 255) || "file";
}
