import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const checks: Record<string, "ok" | "error"> = {};

  let dbError: string | undefined;
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch (e) {
    checks.database = "error";
    dbError = e instanceof Error ? e.message : String(e);
  }

  const allOk = Object.values(checks).every((v) => v === "ok");

  return res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    checks,
    ...(dbError && { dbError }),
    ts: new Date().toISOString(),
  });
}
