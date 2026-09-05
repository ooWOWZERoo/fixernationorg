import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildWelcomeEmail } from "@/lib/emails/welcome";
import { ensureContactForUser, setConsent } from "@/lib/contacts";

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

  // New consumers join Morning Boost automatically once their email is
  // confirmed real -- deliberately not done at registration, since the new
  // recurring-campaign audience resolver has no emailVerified check and
  // would otherwise feed unverified/typo'd addresses into real sends.
  try {
    const contactId = await ensureContactForUser(userId, user.email, user.name, "signup");
    await setConsent(contactId, "MORNING_BOOST", true, "signup");
  } catch (err) {
    console.error("[verify-email] Morning Boost auto-enroll failed:", err);
  }

  // Welcome email — fire and forget
  try {
    const email = buildWelcomeEmail(user.name);
    await sendEmail({ to: user.email, ...email });
  } catch (err) {
    console.error("[email] Failed to send welcome email:", err);
  }

  return res.redirect("/signin?verified=1");
}
