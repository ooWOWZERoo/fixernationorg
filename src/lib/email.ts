import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM ?? "Fixer Nation <noreply@fixernation.org>";
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
  if (!process.env.SMTP_USER) {
    console.warn("[email] SMTP_USER not set — skipping send to", to);
    return;
  }
  await transporter.sendMail({ from: FROM, to, subject, html, text });
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
