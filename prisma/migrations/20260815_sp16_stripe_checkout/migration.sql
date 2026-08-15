-- AlterTable: add Stripe Checkout Session ID to OnboardingRecord for webhook matching
ALTER TABLE "OnboardingRecord" ADD COLUMN "stripeCheckoutSessionId" TEXT;
