-- SP-1: Rich Application Forms + Full Status Model
-- Extends UserApplication + adds ProviderApplicationDetail + AmbassadorApplicationDetail

-- 1. New ApplicationStatus enum values
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'ADDITIONAL_INFO_REQUIRED';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'RESUBMITTED';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'CONDITIONALLY_ACCEPTED';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED_ONBOARDING_REQUIRED';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'ONBOARDING_IN_PROGRESS';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'TERRITORY_PENDING';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'ACTIVE';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'DECLINED';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'WITHDRAWN';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- 2. Extend UserApplication
ALTER TABLE "UserApplication"
  ALTER COLUMN "name" DROP NOT NULL,
  ALTER COLUMN "message" DROP NOT NULL;

ALTER TABLE "UserApplication"
  ADD COLUMN IF NOT EXISTS "phone"            TEXT,
  ADD COLUMN IF NOT EXISTS "contactId"        TEXT,
  ADD COLUMN IF NOT EXISTS "submittedAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "emailVerifiedAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "emailVerifyToken" TEXT,
  ADD COLUMN IF NOT EXISTS "draftExpiresAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "infoRequestNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "referralCode"     TEXT,
  ADD COLUMN IF NOT EXISTS "campaignSource"   TEXT,
  ADD COLUMN IF NOT EXISTS "assignedTo"       TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "UserApplication_emailVerifyToken_key"
  ON "UserApplication"("emailVerifyToken")
  WHERE "emailVerifyToken" IS NOT NULL;

-- 3. ProviderApplicationDetail
CREATE TABLE IF NOT EXISTS "ProviderApplicationDetail" (
  "id"                TEXT        NOT NULL,
  "applicationId"     TEXT        NOT NULL,
  "firstName"         TEXT        NOT NULL DEFAULT '',
  "lastName"          TEXT        NOT NULL DEFAULT '',
  "phone"             TEXT        NOT NULL DEFAULT '',
  "businessName"      TEXT,
  "businessType"      TEXT,
  "yearsInBusiness"   TEXT,
  "website"           TEXT,
  "licenseNumber"     TEXT,
  "insuranceCarrier"  TEXT,
  "insuranceExpiry"   TEXT,
  "serviceCategory"   TEXT,
  "serviceDescription" TEXT,
  "serviceAreas"      TEXT[]      NOT NULL DEFAULT '{}',
  "pricingModel"      TEXT,
  "priceRange"        TEXT,
  "whyJoining"        TEXT,
  "targetAudience"    TEXT,
  "differentiation"   TEXT,
  "linkedinUrl"       TEXT,
  "facebookUrl"       TEXT,
  "instagramUrl"      TEXT,
  "otherSocialUrl"    TEXT,
  "agreedToAccuracy"  BOOLEAN     NOT NULL DEFAULT false,
  "agreedToPolicy"    BOOLEAN     NOT NULL DEFAULT false,
  "agreedToContact"   BOOLEAN     NOT NULL DEFAULT false,
  "signatureName"     TEXT,
  "agreedAt"          TIMESTAMP(3),
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "ProviderApplicationDetail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProviderApplicationDetail_applicationId_key"
  ON "ProviderApplicationDetail"("applicationId");

ALTER TABLE "ProviderApplicationDetail"
  DROP CONSTRAINT IF EXISTS "ProviderApplicationDetail_applicationId_fkey";
ALTER TABLE "ProviderApplicationDetail"
  ADD CONSTRAINT "ProviderApplicationDetail_applicationId_fkey"
  FOREIGN KEY ("applicationId")
  REFERENCES "UserApplication"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. AmbassadorApplicationDetail
CREATE TABLE IF NOT EXISTS "AmbassadorApplicationDetail" (
  "id"                   TEXT        NOT NULL,
  "applicationId"        TEXT        NOT NULL,
  "firstName"            TEXT        NOT NULL DEFAULT '',
  "lastName"             TEXT        NOT NULL DEFAULT '',
  "phone"                TEXT        NOT NULL DEFAULT '',
  "city"                 TEXT,
  "state"                TEXT,
  "occupation"           TEXT,
  "employer"             TEXT,
  "howHeardAboutFN"      TEXT,
  "memberSince"          TEXT,
  "audienceSize"         TEXT,
  "platformsUsed"        TEXT[]      NOT NULL DEFAULT '{}',
  "communityDescription" TEXT,
  "geographicFocus"      TEXT,
  "whyJoining"           TEXT,
  "missionAlignment"     TEXT,
  "referralNetwork"      TEXT,
  "linkedinUrl"          TEXT,
  "facebookUrl"          TEXT,
  "instagramUrl"         TEXT,
  "tiktokUrl"            TEXT,
  "youtubeUrl"           TEXT,
  "podcastUrl"           TEXT,
  "blogUrl"              TEXT,
  "agreedToAccuracy"     BOOLEAN     NOT NULL DEFAULT false,
  "agreedToPolicy"       BOOLEAN     NOT NULL DEFAULT false,
  "agreedToContact"      BOOLEAN     NOT NULL DEFAULT false,
  "signatureName"        TEXT,
  "agreedAt"             TIMESTAMP(3),
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "AmbassadorApplicationDetail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AmbassadorApplicationDetail_applicationId_key"
  ON "AmbassadorApplicationDetail"("applicationId");

ALTER TABLE "AmbassadorApplicationDetail"
  DROP CONSTRAINT IF EXISTS "AmbassadorApplicationDetail_applicationId_fkey";
ALTER TABLE "AmbassadorApplicationDetail"
  ADD CONSTRAINT "AmbassadorApplicationDetail_applicationId_fkey"
  FOREIGN KEY ("applicationId")
  REFERENCES "UserApplication"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
