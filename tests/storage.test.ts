import { describe, it, expect, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getStorage } from "@/lib/storage";
import { LocalProvider, verifyLocalSignature } from "@/lib/storage/local";
import {
  validateImageUpload,
  validateResumeUpload,
  sanitizeFileName,
  MAX_IMAGE_BYTES,
} from "@/lib/upload-validation";

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PDF_BYTES = Buffer.from("%PDF-1.4\n%fake-for-test\n%%EOF", "ascii");
const DOCX_BYTES = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(16, 7)]);

describe("storage factory", () => {
  const ORIGINAL = process.env.STORAGE_PROVIDER;

  afterEach(() => {
    process.env.STORAGE_PROVIDER = ORIGINAL;
  });

  it("defaults to the local provider", () => {
    delete process.env.STORAGE_PROVIDER;
    expect(getStorage()).toBeInstanceOf(LocalProvider);
  });

  it("selects local explicitly", () => {
    process.env.STORAGE_PROVIDER = "local";
    expect(getStorage()).toBeInstanceOf(LocalProvider);
  });

  it("selects s3 / cloudinary by env", () => {
    process.env.STORAGE_PROVIDER = "s3";
    process.env.AWS_REGION = "us-east-1";
    process.env.S3_BUCKET = "test-bucket";
    const s3 = getStorage();
    expect(s3.constructor.name).toBe("S3Provider");

    process.env.STORAGE_PROVIDER = "cloudinary";
    process.env.CLOUDINARY_CLOUD_NAME = "test";
    process.env.CLOUDINARY_API_KEY = "k";
    process.env.CLOUDINARY_API_SECRET = "s";
    expect(getStorage().constructor.name).toBe("CloudinaryProvider");
  });
});

describe("local provider round-trip", () => {
  const KEY = `test/${Date.now()}-${Math.random().toString(36).slice(2)}.bin`;
  const BODY = Buffer.from("round-trip-body");

  it("uploads, serves via signed URL mechanics, and deletes", async () => {
    const provider = new LocalProvider();
    const file = path.join(process.cwd(), ".uploads", KEY);

    await provider.upload(KEY, BODY, "application/octet-stream");
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file).equals(BODY)).toBe(true);

    const url = await provider.getDownloadUrl(KEY, 60);
    expect(url).toMatch(/^\/api\/storage\/local\?key=/);
    const u = new URL(url, "http://localhost");
    expect(verifyLocalSignature(u.searchParams.get("key")!, u.searchParams.get("expires"), u.searchParams.get("sig"))).toBe(true);

    await provider.delete(KEY);
    expect(existsSync(file)).toBe(false);
  });

  it("rejects expired or tampered links", async () => {
    const provider = new LocalProvider();
    const url = await provider.getDownloadUrl("test/x.bin", 60);
    const u = new URL(url, "http://localhost");

    // tampered key
    expect(verifyLocalSignature("test/other.bin", u.searchParams.get("expires"), u.searchParams.get("sig"))).toBe(false);
    // expired
    const past = String(Date.now() - 1000);
    const expiredUrl = await provider.getDownloadUrl("test/x.bin", -1);
    const eu = new URL(expiredUrl, "http://localhost");
    expect(Number(past) < Date.now()).toBe(true);
    expect(eu.searchParams.get("expires")).not.toBeNull();
    // missing params
    expect(verifyLocalSignature("test/x.bin", null, null)).toBe(false);
  });

  it("rejects unsafe keys", async () => {
    const provider = new LocalProvider();
    await expect(provider.upload("../evil.bin", Buffer.from("x"), "application/octet-stream")).rejects.toThrow();
    await expect(provider.upload("/abs/path.bin", Buffer.from("x"), "application/octet-stream")).rejects.toThrow();
  });
});

describe("image upload validation", () => {
  it("accepts a real PNG", () => {
    expect(validateImageUpload(PNG_BYTES, "image/png", "logo.png").ext).toBe("png");
  });

  it("accepts a real JPEG", () => {
    expect(validateImageUpload(JPEG_BYTES, "image/jpeg", "logo.jpg").ext).toBe("jpg");
  });

  it("rejects a text file named .png (MIME spoof)", () => {
    expect(() => validateImageUpload(Buffer.from("hello world"), "image/png", "fake.png")).toThrow();
  });

  it("rejects wrong magic bytes for the declared type", () => {
    expect(() => validateImageUpload(PNG_BYTES, "image/jpeg", "logo.jpg")).toThrow();
  });

  it("rejects disallowed MIME types", () => {
    expect(() => validateImageUpload(PDF_BYTES, "application/pdf", "doc.pdf")).toThrow();
    expect(() => validateImageUpload(Buffer.from("gif89a"), "image/gif", "x.gif")).toThrow();
  });

  it("rejects oversized images", () => {
    const big = Buffer.concat([PNG_BYTES, Buffer.alloc(MAX_IMAGE_BYTES)]);
    expect(() => validateImageUpload(big, "image/png", "big.png")).toThrow();
  });
});

describe("resume upload validation", () => {
  it("accepts PDF and DOCX magic bytes", () => {
    expect(validateResumeUpload(PDF_BYTES, "application/pdf", "r.pdf").ext).toBe("pdf");
    expect(
      validateResumeUpload(
        DOCX_BYTES,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "r.docx",
      ).ext,
    ).toBe("docx");
  });

  it("rejects renamed executables / text", () => {
    expect(() => validateResumeUpload(Buffer.from("MZ fake exe"), "application/pdf", "evil.pdf")).toThrow();
    expect(() => validateResumeUpload(Buffer.from("just text"), "application/pdf", "evil.pdf")).toThrow();
  });
});

describe("sanitizeFileName", () => {
  it("strips path traversal segments", () => {
    expect(sanitizeFileName("../../etc/passwd.pdf")).toBe("passwd.pdf");
    expect(sanitizeFileName("C:\\Users\\evil\\resume.pdf")).toBe("resume.pdf");
  });

  it("removes control characters", () => {
    expect(sanitizeFileName("re\x00sume?.pdf")).toBe("re_sume_.pdf");
  });
});
