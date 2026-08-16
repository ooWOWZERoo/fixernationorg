-- SP-30: CampaignMetric + ContactAttribution

-- CreateEnum
CREATE TYPE "ContactAttributionSource" AS ENUM ('ORGANIC', 'REFERRAL', 'IMPORT', 'MANUAL', 'INVITE', 'SUBSCRIBE_FORM', 'CAMPAIGN');

-- CreateTable
CREATE TABLE "CampaignMetric" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalDelivered" INTEGER NOT NULL DEFAULT 0,
    "totalOpened" INTEGER NOT NULL DEFAULT 0,
    "totalClicked" INTEGER NOT NULL DEFAULT 0,
    "totalBounced" INTEGER NOT NULL DEFAULT 0,
    "totalUnsubscribed" INTEGER NOT NULL DEFAULT 0,
    "openRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clickRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bounceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unsubRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactAttribution" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "source" "ContactAttributionSource" NOT NULL,
    "campaignId" TEXT,
    "referrerId" TEXT,
    "attributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CampaignMetric_campaignId_key" ON "CampaignMetric"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactAttribution_contactId_key" ON "ContactAttribution"("contactId");

-- AddForeignKey
ALTER TABLE "CampaignMetric" ADD CONSTRAINT "CampaignMetric_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactAttribution" ADD CONSTRAINT "ContactAttribution_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
