import { describe, it, expect } from "vitest";
import { renderEmail, escapeHtml } from "@/lib/email/templates";
import { stripHtml } from "@/lib/sanitize";

describe("email templates", () => {
  it("cover letters are stripped to plain text (Phase 12 security review)", () => {
    // regression test for the apply route's stripHtml pipeline
    expect(stripHtml("<p>Hi</p><script>alert(1)</script>I'm a great fit")).toBe("HiI'm a great fit");
  });

  it("interpolates variables into subject and body", () => {
    const { subject, html } = renderEmail("application-status-changed", {
      name: "Mia Chen",
      jobTitle: "Senior React Engineer",
      companyName: "TechNova Solutions",
      status: "IN_REVIEW",
      url: "http://x.dev/account/applications",
    });
    expect(subject).toContain("Senior React Engineer");
    expect(html).toContain("Mia Chen");
    expect(html).toContain("IN_REVIEW");
    expect(html).toContain("TechNova Solutions");
    expect(html).toContain("href=");
  });

  it("escapes HTML injection from names and titles", () => {
    const { html } = renderEmail("application-received", {
      candidateName: '<script>alert(1)</script>',
      jobTitle: '"><img src=x onerror=alert(1)>',
      companyName: "Safe Co",
      url: "http://x.dev/employer",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });

  it("escapes the deep-link URL attribute", () => {
    const { html } = renderEmail("welcome-candidate", {
      name: "A",
      url: 'http://x.dev/?a="><script>x</script>',
    });
    expect(html).not.toContain('"><script>');
  });

  it("renders every template without throwing on missing data", () => {
    const templates = [
      "welcome-candidate",
      "welcome-employer",
      "application-confirmation",
      "application-received",
      "application-status-changed",
    ] as const;
    for (const t of templates) {
      const { subject, html } = renderEmail(t, {});
      expect(subject.length).toBeGreaterThan(0);
      expect(html).toContain("JobBoard");
    }
  });

  it("escapeHtml covers all specials", () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
  });
});
