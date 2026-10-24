-- SP-78: 30-day trial email automation.

-- Fired from the Stripe webhook when a membership subscription enters
-- TRIALING; drives the FULL_TRIAL onboarding journey.
ALTER TYPE "AutomationTrigger" ADD VALUE 'TRIAL_STARTED';

-- tickAutomations() claims each action step by inserting its
-- (enrollmentId, stepOrder) event before sending, so two overlapping ticks
-- (or a re-run after a partial failure) can't send the same step twice --
-- the same check-then-act race 20260920_fix_automation_enrollment_race
-- closed for enrollment creation. NULL stepOrder rows (enrolled, completed,
-- failed, cancelled) are distinct under Postgres unique semantics and never
-- conflict. Production was checked for pre-existing duplicate
-- (enrollmentId, stepOrder) rows before this was added.
CREATE UNIQUE INDEX "AutomationEvent_enrollmentId_stepOrder_key"
  ON "AutomationEvent"("enrollmentId", "stepOrder");
