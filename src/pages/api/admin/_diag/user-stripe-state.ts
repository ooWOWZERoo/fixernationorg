import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

type MembershipDb = {
  userMembership: {
    findFirst: (a: unknown) => Promise<unknown | null>;
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const email = req.query.email as string;
  if (!email) return res.status(400).json({ error: "email required" });

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, stripeCustomerId: true },
  });
  if (!user) return res.status(404).json({ error: "no user with that email" });

  const membershipDb = db as never as MembershipDb;
  const membership = await membershipDb.userMembership.findFirst({
    where: { userId: user.id } as unknown as Record<string, unknown>,
  });

  return res.status(200).json({ user, membership });
}
