-- Retires NewsletterTopic/ContactSubscription: a second, unrelated "newsletter"
-- data model (alongside the ContactConsentTopic.NEWSLETTERS enum value, which
-- is what /admin/campaigns audience rules and /api/public/subscribe actually
-- use) with its own admin UI (/admin/newsletter-topics) and public signup
-- path, but with zero code anywhere that ever read it to send anything.
-- Confirmed via full-codebase review before dropping: no Campaign, cron job,
-- or automation targets ContactSubscription/NewsletterTopic.
DROP TABLE "ContactSubscription";
DROP TABLE "NewsletterTopic";
