import { describe, it, expect } from "vitest";
import {
  validateResumeUpload,
  validateImageUpload,
  buildResumeKey,
  buildMediaKey,
  MAX_RESUME_BYTES,
} from "@/lib/upload-validation";

const PDF_BYTES = Buffer.from("%PDF-1.4\ntest\n%%EOF", "ascii");
const DOCX_BYTES = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(16, 1)]);

describe("resume upload validation boundaries", () => {
  it("accepts a file just under the 5 MB limit", () => {
    const under = Buffer.concat([PDF_BYTES, Buffer.alloc(MAX_RESUME_BYTES - PDF_BYTES.length - 1)]);
    expect(validateResumeUpload(under, "application/pdf", "big.pdf").ext).toBe("pdf");
  });

  it("rejects a file of exactly the limit + 1 byte (413 semantics)", () => {
    const over = Buffer.concat([PDF_BYTES, Buffer.alloc(MAX_RESUME_BYTES - PDF_BYTES.length + 1)]);
    try {
      validateResumeUpload(over, "application/pdf", "big.pdf");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as { status?: number }).status).toBe(413);
    }
  });

  it("rejects empty files", () => {
    expect(() => validateResumeUpload(Buffer.alloc(0), "application/pdf", "empty.pdf")).toThrow();
  });

  it("rejects unsupported declared types with 415 semantics", () => {
    try {
      validateResumeUpload(PDF_BYTES, "text/plain", "doc.txt");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as { status?: number }).status).toBe(415);
    }
  });

  it("rejects a renamed .exe disguised as PDF (magic mismatch, 415)", () => {
    const exe = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64, 0x90)]);
    try {
      validateResumeUpload(exe, "application/pdf", "evil.pdf");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as { status?: number }).status).toBe(415);
    }
  });

  it("accepts DOCX (zip local-file header)", () => {
    expect(
      validateResumeUpload(DOCX_BYTES, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "r.docx").ext,
    ).toBe("docx");
  });

  it("rejects extension/content mismatch", () => {
    expect(() => validateResumeUpload(PDF_BYTES, "application/pdf", "resume.docx")).toThrow();
  });
});

describe("storage key generation", () => {
  it("resume keys are candidate-scoped, UUID-based, extension-suffixed", () => {
    const key = buildResumeKey("cand-123", "pdf");
    expect(key).toMatch(/^resumes\/cand-123\/[0-9a-f-]{36}\.pdf$/);
  });

  it("no client filename ever appears in the key", () => {
    const key = buildResumeKey("cand-123", "pdf");
    expect(key).not.toContain("evil");
    expect(key).not.toContain("..");
  });

  it("keys are unique across calls", () => {
    expect(buildResumeKey("c1", "pdf")).not.toBe(buildResumeKey("c1", "pdf"));
  });

  it("media keys are user-scoped", () => {
    expect(buildMediaKey("u1", "png")).toMatch(/^media\/u1\/[0-9a-f-]{36}\.png$/);
  });
});

describe("image validation status codes", () => {
  it("unsupported image type carries 415", () => {
    try {
      validateImageUpload(Buffer.from("GIF89a..."), "image/gif", "x.gif");
      expect.unreachable();
    } catch (e) {
      expect((e as { status?: number }).status).toBe(415);
    }
  });
});
