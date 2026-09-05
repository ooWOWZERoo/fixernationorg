import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { renderToStaticMarkup } from "react-dom/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { DailyPositivityBoost } from "@/components/home/DailyPositivityBoost";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

// Dry-run render for the edit page's iframe -- shows the current (possibly
// unsaved-in-DB but already-persisted) content exactly as it will look on
// the homepage, regardless of its current status.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.role || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query as { id: string };
  const boost = await db.positivityBoost.findUnique({ where: { id } });
  if (!boost) return res.status(404).json({ error: "Not found" });

  const html = renderToStaticMarkup(
    <DailyPositivityBoost content={boost.content} category={boost.category} isFallback={boost.isFallback} />
  );
  return res.status(200).json({ html });
}
