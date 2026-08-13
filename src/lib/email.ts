import * as postmark from "postmark";

const client = process.env.POSTMARK_API_KEY
  ? new postmark.ServerClient(process.env.POSTMARK_API_KEY)
  : null;

const FROM = process.env.POSTMARK_FROM_EMAIL ?? "noreply@fixernation.org";
const BASE_URL = process.env.NEXTAUTH_URL ?? "https://fixernation.org";

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  if (!client) {
    console.warn("[email] POSTMARK_API_KEY not set — skipping send to", to);
    return;
  }
  await client.sendEmail({ From: FROM, To: to, Subject: subject, HtmlBody: html, TextBody: text });
}

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${BASE_URL}/api/auth/verify-email?token=${token}`;
  await sendEmail({
    to,
    subject: "Verify your Fixer Nation email",
    html: `
      <p>Thanks for joining Fixer Nation. Click the link below to verify your email and activate your account.</p>
      <p><a href="${url}">Verify my email</a></p>
      <p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
    `,
    text: `Verify your Fixer Nation email:\n\n${url}\n\nThis link expires in 24 hours.`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${BASE_URL}/reset-password?token=${token}`;
  await sendEmail({
    to,
    subject: "Reset your Fixer Nation password",
    html: `
      <p>We got a request to reset your Fixer Nation password. Click below to choose a new one.</p>
      <p><a href="${url}">Reset my password</a></p>
      <p>This link expires in 1 hour. If you didn't request a reset, you can ignore this email.</p>
    `,
    text: `Reset your Fixer Nation password:\n\n${url}\n\nThis link expires in 1 hour.`,
  });
}
