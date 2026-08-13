import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const bodySchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  subject: z.string().max(200).optional(),
  body: z.string().min(10).max(2000),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid data." });
  }

  const { name, email, subject, body } = parsed.data;

  await db.fixerQuestion.create({
    data: { name, email, subject: subject ?? null, body },
  });

  const adminEmail = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  if (adminEmail) {
    try {
      await sendEmail({
        to: adminEmail,
        subject: `New Ask The Fixer submission — ${name}`,
        html: `
          <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
          ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ""}
          <p><strong>Message:</strong></p>
          <p style="white-space:pre-wrap">${body}</p>
        `,
        text: `From: ${name} <${email}>\n${subject ? `Subject: ${subject}\n` : ""}Message:\n${body}`,
      });
    } catch (err) {
      console.error("[ask-the-fixer] Failed to send admin notification:", err);
    }
  }

  return res.status(200).json({ ok: true });
}
