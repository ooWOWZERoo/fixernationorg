-- SP-38: Stripe payment integration
-- Adds stripeCustomerId to User, stripeProductId to Product,
-- unique constraint on Price.stripePriceId, and UserMembership model.

ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;
CREATE INDEX "User_stripeCustomerId_idx" ON "User"("stripeCustomerId");

ALTER TABLE "Product" ADD COLUMN "stripeProductId" TEXT;

-- Make stripePriceId unique (was nullable with no constraint before)
ALTER TABLE "Price" ADD CONSTRAINT "Price_stripePriceId_key" UNIQUE ("stripePriceId");

CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE');

CREATE TABLE "UserMembership" (
  "id"                   TEXT NOT NULL,
  "userId"               TEXT NOT NULL,
  "priceId"              TEXT NOT NULL,
  "stripeSubscriptionId" TEXT,
  "stripeCustomerId"     TEXT,
  "status"               "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "currentPeriodEnd"     TIMESTAMP(3),
  "cancelAtPeriodEnd"    BOOLEAN NOT NULL DEFAULT false,
  "trialEnd"             TIMESTAMP(3),
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserMembership_userId_key" ON "UserMembership"("userId");
CREATE UNIQUE INDEX "UserMembership_stripeSubscriptionId_key" ON "UserMembership"("stripeSubscriptionId");
CREATE INDEX "UserMembership_stripeSubscriptionId_idx" ON "UserMembership"("stripeSubscriptionId");
CREATE INDEX "UserMembership_status_idx" ON "UserMembership"("status");

ALTER TABLE "UserMembership" ADD CONSTRAINT "UserMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserMembership" ADD CONSTRAINT "UserMembership_priceId_fkey"
  FOREIGN KEY ("priceId") REFERENCES "Price"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
