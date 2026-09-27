-- SP-77: Manual membership grant
-- Lets an admin create a brand-new account plus a tracked UserMembership for
-- a customer who already paid on a previous platform (Wix). The grant needs
-- its own source value so it is never mistaken for a real Stripe
-- subscription (no stripeSubscriptionId, never auto-renews) nor for a free
-- book-gift membership (the gift copy upsells to paid, which reads wrong for
-- someone who has already paid).

-- AlterEnum
-- Note: ALTER TYPE ADD VALUE must not be referenced by other DDL in the same
-- transaction. Nothing below writes the new value, so this is safe.
ALTER TYPE "MembershipSource" ADD VALUE IF NOT EXISTS 'MANUAL_GRANT';
