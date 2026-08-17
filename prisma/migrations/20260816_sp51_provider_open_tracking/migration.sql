-- SP-51: Add open tracking to provider campaign sends
ALTER TABLE "ProviderCampaignSend" ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3);
