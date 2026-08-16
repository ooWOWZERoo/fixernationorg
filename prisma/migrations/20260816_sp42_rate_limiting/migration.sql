-- SP-42: Rate limiting entries table
CREATE TABLE "RateLimitEntry" (
  "key"         TEXT NOT NULL,
  "count"       INTEGER NOT NULL DEFAULT 1,
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RateLimitEntry_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "RateLimitEntry_windowStart_idx" ON "RateLimitEntry"("windowStart");
