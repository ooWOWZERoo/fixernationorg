import { db } from "@/lib/db";
import type { NextApiRequest } from "next";

export function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

export async function checkRateLimit(
  key: string,
  maxHits: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const windowCutoff = new Date(Date.now() - windowMs);

  // Atomic UPSERT: reset window if expired, else increment count
  const result = await db.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitEntry" ("key", "count", "windowStart")
    VALUES (${key}, 1, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitEntry"."windowStart" < ${windowCutoff} THEN 1
        ELSE "RateLimitEntry"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimitEntry"."windowStart" < ${windowCutoff} THEN CURRENT_TIMESTAMP
        ELSE "RateLimitEntry"."windowStart"
      END
    RETURNING "count"
  `;

  const count = Number(result[0]?.count ?? 1);

  // Lazy cleanup: delete entries older than 24h (fire-and-forget)
  db.$executeRaw`
    DELETE FROM "RateLimitEntry" WHERE "windowStart" < ${new Date(Date.now() - 86400000)}
  `.catch(() => {});

  if (count > maxHits) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: maxHits - count };
}
