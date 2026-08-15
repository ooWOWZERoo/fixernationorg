-- SP-28: Audience Builder
-- Adds audienceRules column to Campaign and creates CampaignAudienceSnapshot table

ALTER TABLE "Campaign" ADD COLUMN "audienceRules" JSONB;

CREATE TABLE "CampaignAudienceSnapshot" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalIncluded" INTEGER NOT NULL,
    "totalSuppressed" INTEGER NOT NULL,
    "rules" JSONB NOT NULL,
    CONSTRAINT "CampaignAudienceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignAudienceSnapshot_campaignId_key" ON "CampaignAudienceSnapshot"("campaignId");

ALTER TABLE "CampaignAudienceSnapshot" ADD CONSTRAINT "CampaignAudienceSnapshot_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
