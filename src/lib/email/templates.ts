/**
 * Email templates — pure functions returning { subject, html }.
 * All dynamic values are HTML-escaped (names/titles must never inject markup).
 */

export type EmailTemplate =
  | "welcome-candidate"
  | "welcome-employer"
  | "application-confirmation"
  | "application-received"
  | "application-status-changed";

export type EmailData = {
  name?: string;
  jobTitle?: string;
  jobSlug?: string;
  companyName?: string;
  companySlug?: string;
  candidateName?: string;
  status?: string;
  url?: string;
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

const layout = (title: string, body: string): string => `
<!doctype html>
<html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">
    <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;font-size:18px;font-weight:bold;color:#0f172a;">
      JobBoard
    </div>
    <div style="padding:24px;color:#334155;font-size:14px;line-height:1.6;">
      <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;">${title}</h2>
      ${body}
    </div>
    <div style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
      You are receiving this because you have a JobBoard account.
    </div>
  </div>
</body></html>`;

const cta = (url: string, label: string): string =>
  `<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;">${label}</a></p>`;

export function renderEmail(
  template: EmailTemplate,
  data: EmailData,
): { subject: string; html: string } {
  const name = escapeHtml(data.name ?? "there");
  const jobTitle = escapeHtml(data.jobTitle ?? "a job");
  const companyName = escapeHtml(data.companyName ?? "a company");
  const candidateName = escapeHtml(data.candidateName ?? "A candidate");
  const status = escapeHtml(data.status ?? "");
  const url = escapeHtml(data.url ?? "#");

  switch (template) {
    case "welcome-candidate":
      return {
        subject: "Welcome to JobBoard",
        html: layout(
          `Welcome, ${name}!`,
          `<p>Your candidate account is ready. Complete your profile and upload a resume to start applying.</p>` +
            cta(url, "Complete your profile"),
        ),
      };

    case "welcome-employer":
      return {
        subject: "Welcome to JobBoard",
        html: layout(
          `Welcome, ${name}!`,
          `<p>${companyName} is ready on JobBoard. Post your first job to start receiving applications.</p>` +
            cta(url, "Post a job"),
        ),
      };

    case "application-confirmation":
      return {
        subject: `Application received — ${jobTitle}`,
        html: layout(
          "Application received",
          `<p>Hi ${name},</p><p>Your application for <strong>${jobTitle}</strong> at ${companyName} was submitted successfully.</p>` +
            cta(url, "Track your application"),
        ),
      };

    case "application-received":
      return {
        subject: `New application — ${jobTitle}`,
        html: layout(
          "New application received",
          `<p><strong>${candidateName}</strong> applied for <strong>${jobTitle}</strong>.</p>` +
            cta(url, "Review application"),
        ),
      };

    case "application-status-changed":
      return {
        subject: `Application update — ${jobTitle}`,
        html: layout(
          "Your application status changed",
          `<p>Hi ${name},</p><p>Your application for <strong>${jobTitle}</strong> at ${companyName} moved to <strong>${status}</strong>.</p>` +
            cta(url, "View timeline"),
        ),
      };
  }
}
