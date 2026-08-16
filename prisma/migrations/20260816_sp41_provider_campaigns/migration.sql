-- SP-41: Provider Campaign Creation

CREATE TYPE "ProviderCampaignStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT', 'CANCELLED');
CREATE TYPE "ProviderCampaignSendStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

CREATE TABLE "ProviderContact" (
  "id"             TEXT NOT NULL,
  "providerUserId" TEXT NOT NULL,
  "firstName"      TEXT,
  "lastName"       TEXT,
  "email"          TEXT NOT NULL,
  "phone"          TEXT,
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderContact_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProviderContact_providerUserId_email_key" ON "ProviderContact"("providerUserId", "email");
CREATE INDEX "ProviderContact_providerUserId_idx" ON "ProviderContact"("providerUserId");
ALTER TABLE "ProviderContact" ADD CONSTRAINT "ProviderContact_providerUserId_fkey"
  FOREIGN KEY ("providerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProviderCampaign" (
  "id"             TEXT NOT NULL,
  "providerUserId" TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "subject"        TEXT NOT NULL,
  "fromName"       TEXT NOT NULL,
  "htmlBody"       TEXT NOT NULL,
  "textBody"       TEXT,
  "status"         "ProviderCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "sentAt"         TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderCampaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProviderCampaign_providerUserId_idx" ON "ProviderCampaign"("providerUserId");
CREATE INDEX "ProviderCampaign_status_idx" ON "ProviderCampaign"("status");
ALTER TABLE "ProviderCampaign" ADD CONSTRAINT "ProviderCampaign_providerUserId_fkey"
  FOREIGN KEY ("providerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProviderCampaignSend" (
  "id"                TEXT NOT NULL,
  "campaignId"        TEXT NOT NULL,
  "providerContactId" TEXT NOT NULL,
  "status"            "ProviderCampaignSendStatus" NOT NULL DEFAULT 'QUEUED',
  "sentAt"            TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderCampaignSend_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProviderCampaignSend_campaignId_providerContactId_key" ON "ProviderCampaignSend"("campaignId", "providerContactId");
CREATE INDEX "ProviderCampaignSend_campaignId_idx" ON "ProviderCampaignSend"("campaignId");
ALTER TABLE "ProviderCampaignSend" ADD CONSTRAINT "ProviderCampaignSend_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "ProviderCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderCampaignSend" ADD CONSTRAINT "ProviderCampaignSend_providerContactId_fkey"
  FOREIGN KEY ("providerContactId") REFERENCES "ProviderContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
