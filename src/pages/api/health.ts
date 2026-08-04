import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const checks: Record<string, "ok" | "error"> = {};

  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");

  return res.status(allOk ? 200 : 503).json({
    status: allOk ? "ok" : "degraded",
    checks,
    ts: new Date().toISOString(),
  });
}
