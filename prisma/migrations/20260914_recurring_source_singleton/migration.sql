-- Guards against a real structural risk found during a review of the
-- Morning Boost / Campaign recurring-dispatch relationship: nothing
-- previously stopped a second recurring Campaign template from being
-- created with the same recurrenceSource (today, only MORNING_BOOST
-- exists). runCampaignRecurringDispatch (src/pages/api/cron.ts) has no
-- cross-template dedup at all -- two templates for the same source would
-- each independently find and send the same day's content, at whatever
-- two different recurrenceTime values they had, to whatever audiences
-- each defined. This has never happened in production (verified: exactly
-- one MORNING_BOOST template has ever existed), but nothing was actually
-- preventing it. A partial unique index (not expressible via Prisma's
-- declarative @@unique) is the DB-level backstop; src/pages/api/admin/
-- campaigns/index.ts also checks this up front for a clean 409 instead of
-- a raw constraint-violation error.
CREATE UNIQUE INDEX "Campaign_recurrenceSource_singleton_idx"
  ON "Campaign" ("recurrenceSource")
  WHERE "isRecurring" = true AND "recurrenceSource" IS NOT NULL;
