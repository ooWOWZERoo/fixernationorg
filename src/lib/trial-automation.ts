// Shared between /api/public/subscribe (applies the tag), the Stripe webhook
// (cancels the journey on a track switch) and
// scripts/seed-trial-email-automation.ts (the MB_ONLY journey's
// TAG_ADDED triggerConfig). Must stay distinct from "newsletter-subscriber",
// which every subscribe call applies.
export const MB_TRIAL_TAG = "mb-trial-30day";

// The trial.fixernation.org landing page's Morning Boost signup source --
// see src/pages/trial-landing.tsx and runMorningBoostTrialExpiry in
// src/pages/api/cron.ts.
export const MB_TRIAL_SOURCE = "trial_landing_30day";
