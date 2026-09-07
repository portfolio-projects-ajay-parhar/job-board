import { Resend } from "resend";
import { prisma } from "./prisma";
import { renderEmail, type EmailData, type EmailTemplate } from "./email/templates";

/**
 * Transactional email — every send writes an EmailLog row.
 * Never throws: email must never break an API response.
 * Unconfigured (no RESEND_API_KEY/EMAIL_FROM) → SKIPPED log row.
 */
export async function sendEmail(opts: {
  to: string;
  template: EmailTemplate;
  data: EmailData;
}): Promise<void> {
  const { subject, html } = renderEmail(opts.template, opts.data);

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    await prisma.emailLog
      .create({
        data: { to: opts.to, template: opts.template, subject, status: "SKIPPED", meta: { data: opts.data } },
      })
      .catch(() => {});
    return;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: opts.to,
      subject,
      html,
    });
    if (error) throw new Error(error.message);
    await prisma.emailLog
      .create({
        data: { to: opts.to, template: opts.template, subject, status: "SENT", meta: { data: opts.data } },
      })
      .catch(() => {});
  } catch (e) {
    // logged, not rethrown
    await prisma.emailLog
      .create({
        data: {
          to: opts.to,
          template: opts.template,
          subject,
          status: "FAILED",
          meta: { error: String(e), data: opts.data },
        },
      })
      .catch(() => {});
  }
}

/** Fire-and-forget helper for post-commit hooks. */
export function sendEmailSafe(opts: Parameters<typeof sendEmail>[0]): void {
  void sendEmail(opts).catch(() => {});
}

/** Absolute deep link for emails. */
export const appUrl = (path: string): string =>
  `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}${path}`;
