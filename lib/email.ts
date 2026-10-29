import "server-only";

// Sending email with Resend — Member B. Repo path: lib/email.ts
// Uses Resend's HTTP API directly, so no extra package is needed.
//
// Env:
//   RESEND_API_KEY   from resend.com → API Keys
//   EMAIL_FROM       an address on the domain verified in Resend, e.g.
//                    "LabPass <notifications@updates.labpass.xyz>"
//                    (see API.md → "D: email domain"). Resend's test sender onboarding@resend.dev
//                    only delivers to the Resend account owner, so don't use it for the demo.
//   NEXT_PUBLIC_APP_URL  e.g. https://labpass.vercel.app (for links in emails)

import type { NotificationMessage } from "@/lib/notifications/messages";

export type SendResult = { ok: true } | { ok: false; error: string; retry: boolean };

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderEmail(name: string, msg: NotificationMessage) {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const link = base && msg.href ? `${base}${msg.href}` : base || null;
  const greeting = name ? `Hi ${name},` : "Hi,";

  const text = [greeting, "", msg.body, "", link ? `Open LabPass: ${link}` : "", "", "— LabPass, Northfield Institute of Technology"]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px">
<tr><td>
<p style="margin:0 0 16px;font-size:13px;color:#57534e">LabPass</p>
<h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(msg.title)}</h1>
<p style="margin:0 0 8px;font-size:15px;line-height:1.5">${escapeHtml(greeting)}</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">${escapeHtml(msg.body)}</p>
${link ? `<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px">Open LabPass</a></p>` : ""}
<p style="margin:0;font-size:12px;color:#78716c">Northfield Institute of Technology · demo data only</p>
</td></tr></table></body></html>`;

  return { subject: `LabPass: ${msg.title}`, text, html };
}

export async function sendEmail(
  to: string,
  content: { subject: string; text: string; html: string },
  idempotencyKey: string,
): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, error: "RESEND_API_KEY or EMAIL_FROM is not set", retry: false };

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey, // the notification id, so a retry never sends twice
      },
      body: JSON.stringify({ from, to: [to], subject: content.subject, text: content.text, html: content.html }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error", retry: true };
  }
  if (res.ok) return { ok: true };
  const detail = await res.text().catch(() => "");
  // 429 (rate limit) and 5xx are worth retrying next run; 4xx (bad address etc.) are not.
  return { ok: false, error: `Resend ${res.status}: ${detail.slice(0, 200)}`, retry: res.status === 429 || res.status >= 500 };
}
