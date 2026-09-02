-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "RecurrenceSource" AS ENUM ('MORNING_BOOST');

-- AlterTable
ALTER TABLE "Campaign"
  ADD COLUMN "isRecurring" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "recurrenceFrequency" "RecurrenceFrequency",
  ADD COLUMN "recurrenceTime" TEXT,
  ADD COLUMN "recurrenceSource" "RecurrenceSource",
  ADD COLUMN "recurrenceActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "lastMorningBoostId" TEXT,
  ADD COLUMN "parentCampaignId" TEXT;

-- CreateIndex
CREATE INDEX "Campaign_isRecurring_recurrenceActive_idx" ON "Campaign"("isRecurring", "recurrenceActive");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_parentCampaignId_fkey"
  FOREIGN KEY ("parentCampaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "RecurrenceRun" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "childCampaignId" TEXT,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecurrenceRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecurrenceRun_templateId_scheduledDate_key" ON "RecurrenceRun"("templateId", "scheduledDate");

-- AddForeignKey
ALTER TABLE "RecurrenceRun" ADD CONSTRAINT "RecurrenceRun_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
