// Campaign.recurrenceTime is stored as a plain "HH:MM" UTC time-of-day string
// (runCampaignRecurringDispatch in src/pages/api/cron.ts gates dispatch by
// comparing this directly against now.getUTCHours()) — it is genuinely UTC,
// not just mislabeled. Admin UI should show it converted to the viewer's
// local time rather than the raw UTC value or a hardcoded "UTC" label,
// which is what admins were actually seeing before and found confusing.
export function formatUtcTimeOfDayLocal(hhmm: string | null | undefined): string {
  if (!hhmm) return "—";
  const [hh, mm] = hhmm.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return hhmm;

  const now = new Date();
  const utcInstant = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh, mm));
  return utcInstant.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
