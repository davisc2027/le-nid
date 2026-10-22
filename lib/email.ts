import nodemailer from "nodemailer";

// Weekly summary email. Preferred route: the same SMTP mailbox Supabase uses for sign-in codes (SMTP_* variables below),
// so codes and summaries come from one sender. Fallback: Resend, if only RESEND_API_KEY is set.
// Supabase cannot send custom emails through its own SMTP settings (only its auth templates), so the app connects to the
// same mailbox directly.
const smtpUser = () => process.env.SMTP_USER?.trim();
const smtpPass = () => process.env.SMTP_PASS?.replace(/\s+/g, ""); // Gmail app passwords are shown with spaces

export const emailConfigured = () => !!(smtpUser() && smtpPass()) || !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function sendEmail(to: string, subject: string, text: string) {
  if (!to) return;
  const user = smtpUser(), pass = smtpPass();
  if (user && pass) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 8_000,
      socketTimeout: 12_000,
    });
    try {
      await transport.sendMail({ from: process.env.EMAIL_FROM?.trim() || `Le Nid <${user}>`, to, subject, text });
    } catch { /* a failed summary must never break the reminder run */ }
    return;
  }
  const key = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM;
  if (!key || !from) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  }).catch(() => {});
}
