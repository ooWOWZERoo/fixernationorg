-- SP-7: reapplication linkage + expiration reminder tracking
ALTER TABLE "UserApplication"
  ADD COLUMN IF NOT EXISTS "previousApplicationId" TEXT,
  ADD COLUMN IF NOT EXISTS "expirationReminderSentAt" TIMESTAMP(3);

-- Seed reapplication waiting period settings (no-op if already present)
INSERT INTO "Setting" (key, value, "updatedAt")
VALUES
  ('provider_reapplication_days', '90', NOW()),
  ('ambassador_reapplication_days', '90', NOW())
ON CONFLICT (key) DO NOTHING;
