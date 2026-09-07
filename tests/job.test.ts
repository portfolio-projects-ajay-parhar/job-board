import { describe, it, expect } from "vitest";
import { canTransitionJob, assertJobTransition, jobStatusActions } from "@/lib/job-status";
import { uniqueSlug, slugifyTitle } from "@/lib/slug";
import { sanitizeRichText, stripHtml } from "@/lib/sanitize";

const STATUSES = ["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"] as const;

const LEGAL: [string, string][] = [
  ["DRAFT", "PUBLISHED"],
  ["PUBLISHED", "CLOSED"],
  ["PUBLISHED", "ARCHIVED"],
  ["CLOSED", "PUBLISHED"],
  ["CLOSED", "ARCHIVED"],
  ["DRAFT", "ARCHIVED"],
];

const ALL_PAIRS: [string, string][] = STATUSES.flatMap((from) =>
  STATUSES.map((to) => [from, to] as [string, string]),
);

describe("job status machine", () => {
  it("accepts every legal transition", () => {
    for (const [from, to] of LEGAL) {
      expect(canTransitionJob(from, to), `${from} → ${to}`).toBe(true);
      expect(() => assertJobTransition(from, to)).not.toThrow();
    }
  });

  it("rejects every illegal transition (422 semantics)", () => {
    for (const [from, to] of ALL_PAIRS) {
      if (!LEGAL.some(([f, t]) => f === from && t === to)) {
        expect(canTransitionJob(from, to), `${from} → ${to} should be illegal`).toBe(false);
        expect(() => assertJobTransition(from, to)).toThrow();
      }
    }
  });

  it("ARCHIVED is terminal", () => {
    expect(jobStatusActions("ARCHIVED")).toEqual([]);
    for (const to of STATUSES) expect(canTransitionJob("ARCHIVED", to)).toBe(false);
  });

  it("exposes machine-legal UI actions per status", () => {
    expect(jobStatusActions("DRAFT")).toEqual(["PUBLISHED", "ARCHIVED"]);
    expect(jobStatusActions("PUBLISHED")).toEqual(["CLOSED", "ARCHIVED"]);
    expect(jobStatusActions("CLOSED")).toEqual(["PUBLISHED", "ARCHIVED"]);
    expect(jobStatusActions("ARCHIVED")).toEqual([]);
  });

  it("rejects transitions from unknown statuses", () => {
    expect(canTransitionJob("UNKNOWN", "PUBLISHED")).toBe(false);
    expect(() => assertJobTransition("UNKNOWN", "PUBLISHED")).toThrow();
  });
});

describe("uniqueSlug", () => {
  it("returns the base slug when free", async () => {
    const taken = new Set<string>();
    expect(await uniqueSlug("senior-dev", (s) => Promise.resolve(taken.has(s)))).toBe("senior-dev");
  });

  it("appends -2, -3 … on collisions", async () => {
    const taken = new Set(["senior-dev", "senior-dev-2", "senior-dev-3"]);
    expect(await uniqueSlug("senior-dev", (s) => Promise.resolve(taken.has(s)))).toBe("senior-dev-4");
  });
});

describe("slugifyTitle", () => {
  it("slugifies titles", () => {
    expect(slugifyTitle("Senior React Engineer!")).toBe("senior-react-engineer");
    expect(slugifyTitle("  Multiple   Spaces  ")).toBe("multiple-spaces");
    expect(slugifyTitle("C++ & C# Roles")).toBe("c-c-roles");
  });
});

describe("sanitizeRichText", () => {
  it("strips scripts, styles and iframes", () => {
    const dirty = `<p>Hello</p><script>alert(1)</script><style>*{}</style><iframe src="x"></iframe>`;
    const clean = sanitizeRichText(dirty);
    expect(clean).toContain("<p>Hello</p>");
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("alert");
    expect(clean).not.toContain("iframe");
    expect(clean).not.toContain("style");
  });

  it("strips event handlers and javascript: URLs", () => {
    const dirty = `<p onclick="alert(1)">Hi</p><a href="javascript:alert(1)">x</a>`;
    const clean = sanitizeRichText(dirty);
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
  });

  it("keeps allowed formatting tags and links", () => {
    const clean = sanitizeRichText(`<ul><li><b>fast</b></li></ul><a href="https://x.dev">link</a>`);
    expect(clean).toContain("<ul><li><b>fast</b></li></ul>");
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  it("stripHtml removes all tags", () => {
    expect(stripHtml("<p>a<b>b</b></p>")).toBe("ab");
  });
});
