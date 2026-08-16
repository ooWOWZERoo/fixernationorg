-- Add PUSH_NOTIFICATIONS to ContactConsentTopic enum
ALTER TYPE "ContactConsentTopic" ADD VALUE 'PUSH_NOTIFICATIONS';

-- Create CampaignChannelType enum
CREATE TYPE "CampaignChannelType" AS ENUM ('EMAIL', 'PUSH');

-- Add channelType, pushUrl, pushIcon to Campaign; make htmlBody nullable
ALTER TABLE "Campaign" ADD COLUMN "channelType" "CampaignChannelType" NOT NULL DEFAULT 'EMAIL';
ALTER TABLE "Campaign" ADD COLUMN "pushUrl" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "pushIcon" TEXT;
ALTER TABLE "Campaign" ALTER COLUMN "htmlBody" DROP NOT NULL;

-- CreateTable: PushSubscription
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dhKey" TEXT NOT NULL,
    "authKey" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "PushSubscription_userId_endpoint_key" ON "PushSubscription"("userId", "endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
