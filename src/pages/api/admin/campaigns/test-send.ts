import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { sendEmail } from "@/lib/email";

const schema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  htmlBody: z.string().min(1),
  textBody: z.string().optional(),
  fromName: z.string().optional(),
  fromEmail: z.string().email().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole ?? "")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  }

  const { to, subject, htmlBody, textBody, fromName, fromEmail } = parsed.data;

  const testBanner = `<div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:6px;padding:8px 12px;margin-bottom:20px;font-family:sans-serif;font-size:13px;color:#92400e;"><strong>TEST SEND</strong> — This is a preview sent to ${to}. It was not sent to campaign recipients.</div>`;

  try {
    const from = fromName && fromEmail
      ? `${fromName} <${fromEmail}>`
      : fromEmail ?? undefined;

    await sendEmail({
      to,
      subject: `[TEST] ${subject}`,
      html: testBanner + htmlBody,
      text: textBody ? `[TEST SEND]\n\n${textBody}` : "",
      from,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[test-send]", err);
    return res.status(500).json({ error: "Failed to send test email. Check SMTP configuration." });
  }
}
