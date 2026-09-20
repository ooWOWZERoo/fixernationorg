-- Fix bug: enrollInJourneys() checks for an existing ACTIVE enrollment with
-- findFirst, then create()s a new one if none is found -- a classic
-- check-then-act race. Two concurrent triggers for the same journey+user
-- (e.g. a badge and a streak milestone crossed in the same Tune Your Brain
-- session) can both pass the findFirst check before either commits its
-- create, producing two ACTIVE rows for the same journey+user and sending
-- the same automation email twice. Add partial unique indexes scoped to
-- ACTIVE rows only -- a plain unique index would incorrectly block a
-- legitimate fresh enrollment once a prior one moves to
-- COMPLETED/CANCELLED/FAILED, the same reasoning already documented for
-- PathwayEnrollment/ChallengeEnrollment in migration
-- 20260818_sp65_fix_enrollment_unique. userId and contactId are mutually
-- exclusive in practice (enrollInJourneys prefers userId when present), so
-- each identity path gets its own partial index.

CREATE UNIQUE INDEX "AutomationEnrollment_journeyId_userId_active_key"
  ON "AutomationEnrollment"("journeyId", "userId")
  WHERE "status" = 'ACTIVE' AND "userId" IS NOT NULL;

CREATE UNIQUE INDEX "AutomationEnrollment_journeyId_contactId_active_key"
  ON "AutomationEnrollment"("journeyId", "contactId")
  WHERE "status" = 'ACTIVE' AND "contactId" IS NOT NULL;
