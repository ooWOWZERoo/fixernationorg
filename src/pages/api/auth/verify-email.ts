import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildWelcomeEmail } from "@/lib/emails/welcome";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.query.token as string;
  if (!token) return res.redirect("/signin?error=InvalidToken");

  const record = await db.verificationToken.findUnique({ where: { token } });
  if (!record || !record.identifier.startsWith("verify:")) {
    return res.redirect("/signin?error=InvalidToken");
  }
  if (record.expires < new Date()) {
    await db.verificationToken.delete({ where: { token } });
    return res.redirect("/signin?error=ExpiredToken");
  }

  const userId = record.identifier.replace("verify:", "");
  const user = await db.user.update({
    where: { id: userId },
    data: { emailVerified: new Date() },
    select: { email: true, name: true },
  });
  await db.verificationToken.delete({ where: { token } });

  // Welcome email — fire and forget
  try {
    const email = buildWelcomeEmail(user.name);
    await sendEmail({ to: user.email, ...email });
  } catch (err) {
    console.error("[email] Failed to send welcome email:", err);
  }

  return res.redirect("/signin?verified=1");
}
