import { z } from "zod";

/**
 * Validated environment variables.
 * Required-for-Stage-0 vars throw on missing; later-phase vars are optional stubs.
 * Throws at startup in production when required vars are absent.
 */
const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // ── Required: Stage 0 ──────────────────────────────────────────────────────
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 chars"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET is required"),
  DESIGN_PREVIEW_PASSWORD: z.string().optional(),

  // ── Required: Phase 1 (stubs until then) ───────────────────────────────────
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // ── Optional: Phase 1+ ─────────────────────────────────────────────────────
  SENTRY_DSN: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

function buildEnv() {
  if (typeof window !== "undefined") {
    return clientSchema.parse({
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    }) as z.infer<typeof serverSchema> & z.infer<typeof clientSchema>;
  }

  const server = serverSchema.safeParse(process.env);
  if (!server.success && process.env.NODE_ENV === "production") {
    const errors = server.error.flatten().fieldErrors;
    console.error("[env] Invalid server environment:", errors);
    throw new Error("[env] Invalid server environment — check .env");
  }

  const client = clientSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });

  return { ...(server.data ?? {}), ...client } as z.infer<typeof serverSchema> &
    z.infer<typeof clientSchema>;
}

export const env = buildEnv();
