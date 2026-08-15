-- SP-5: Onboarding Record
-- Tracks pricing snapshot and payment status for accepted applicants

CREATE TYPE "PricingType" AS ENUM (
  'CURRENT',
  'QUOTED',
  'PROMOTIONAL',
  'PARTIAL_DISCOUNT',
  'FULL_WAIVER',
  'TRIAL',
  'COMPLIMENTARY'
);

CREATE TYPE "OnboardingPaymentStatus" AS ENUM (
  'PENDING',
  'COMPLETED',
  'WAIVED',
  'FAILED'
);

CREATE TABLE "OnboardingRecord" (
    "id"                    TEXT NOT NULL,
    "applicationId"         TEXT NOT NULL,
    "pricingType"           "PricingType" NOT NULL DEFAULT 'CURRENT',
    "quotedAmount"          DECIMAL(10,2),
    "finalAmount"           DECIMAL(10,2),
    "discountPercent"       DECIMAL(5,2),
    "paymentStatus"         "OnboardingPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt"                TIMESTAMP(3),
    "stripePaymentIntentId" TEXT,
    "stripePaymentLinkUrl"  TEXT,
    "waiverReason"          TEXT,
    "notes"                 TEXT,
    "createdBy"             TEXT NOT NULL,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnboardingRecord_applicationId_key"
    ON "OnboardingRecord"("applicationId");

ALTER TABLE "OnboardingRecord"
    ADD CONSTRAINT "OnboardingRecord_applicationId_fkey"
    FOREIGN KEY ("applicationId")
    REFERENCES "UserApplication"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
