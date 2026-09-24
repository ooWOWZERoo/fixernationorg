-- SP-69: Standalone Affiliate application type
-- Adds an AFFILIATE application type + user role and a lean detail table
-- so someone can apply as a pure affiliate without becoming a Service
-- Provider or Brand Ambassador.

-- AlterEnum
-- Note: ALTER TYPE ADD VALUE must not be referenced by other DDL in the same
-- transaction. Nothing below writes the new values, so this is safe.
ALTER TYPE "ApplicationType" ADD VALUE IF NOT EXISTS 'AFFILIATE';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'AFFILIATE';

-- CreateTable
CREATE TABLE "AffiliateApplicationDetail" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "city" TEXT,
    "state" TEXT,
    "howHeardAboutFN" TEXT,
    "audienceSize" TEXT,
    "platformsUsed" TEXT[],
    "geographicFocus" TEXT,
    "whyJoining" TEXT,
    "linkedinUrl" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "tiktokUrl" TEXT,
    "youtubeUrl" TEXT,
    "podcastUrl" TEXT,
    "blogUrl" TEXT,
    "agreedToAccuracy" BOOLEAN NOT NULL DEFAULT false,
    "agreedToPolicy" BOOLEAN NOT NULL DEFAULT false,
    "agreedToContact" BOOLEAN NOT NULL DEFAULT false,
    "signatureName" TEXT,
    "agreedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AffiliateApplicationDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateApplicationDetail_applicationId_key" ON "AffiliateApplicationDetail"("applicationId");

-- AddForeignKey
ALTER TABLE "AffiliateApplicationDetail" ADD CONSTRAINT "AffiliateApplicationDetail_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "UserApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
