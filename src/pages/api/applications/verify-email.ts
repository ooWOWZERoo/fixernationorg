import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://fixernation.org";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { token } = req.query;
  if (!token || typeof token !== "string") {
    return res.redirect(`${BASE_URL}/apply/confirmed?verified=error&reason=missing_token`);
  }

  const application = await db.userApplication.findFirst({
    where: { emailVerifyToken: token },
    select: { id: true, type: true, emailVerifiedAt: true },
  });

  if (!application) {
    return res.redirect(`${BASE_URL}/apply/confirmed?verified=error&reason=invalid_token`);
  }

  if (application.emailVerifiedAt) {
    const type = application.type.toLowerCase();
    return res.redirect(`${BASE_URL}/apply/confirmed?verified=already&type=${type}`);
  }

  await db.userApplication.update({
    where: { id: application.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerifyToken: null,
    },
  });

  const type = application.type.toLowerCase();
  return res.redirect(`${BASE_URL}/apply/confirmed?verified=yes&type=${type}`);
}
