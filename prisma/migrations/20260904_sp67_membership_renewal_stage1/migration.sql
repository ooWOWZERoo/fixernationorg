-- SP-67 Stage 1: Membership renewal tracking foundation
-- Adds membership source tracking + reminder timestamps, makes gift-code
-- membership grants time-bound, and seeds the dedicated free-90-day gift
-- membership Product/Price so redeem.ts can look it up by slug at runtime.

-- CreateEnum
CREATE TYPE "MembershipSource" AS ENUM ('STRIPE', 'GIFT_CODE');

-- AlterTable
ALTER TABLE "UserMembership"
  ADD COLUMN "source" "MembershipSource" NOT NULL DEFAULT 'STRIPE',
  ADD COLUMN "renewal30ReminderSentAt" TIMESTAMP(3),
  ADD COLUMN "renewal7ReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GiftCode"
  ADD COLUMN "membershipDurationDays" INTEGER;

-- Seed: dedicated Product + Price for the free 90-day book-gift membership.
-- Looked up at runtime by Product.slug — never hardcode these ids in app code.
INSERT INTO "Product" ("id", "type", "name", "slug", "features", "active", "sortOrder", "createdAt", "updatedAt")
VALUES (
  'prod_gift_membership_90d',
  'MEMBERSHIP',
  'Free 90-Day Membership (Book Gift)',
  'free-90-day-book-gift',
  ARRAY[]::TEXT[],
  true,
  0,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Price" ("id", "productId", "interval", "amount", "currency", "membershipRole", "stripePriceId", "active", "createdAt", "updatedAt")
VALUES (
  'price_gift_membership_90d',
  'prod_gift_membership_90d',
  'ONE_TIME',
  0,
  'usd',
  'MEMBER',
  NULL,
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;
