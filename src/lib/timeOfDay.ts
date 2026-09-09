// Campaign.recurrenceTime is stored as a plain "HH:MM" UTC time-of-day string
// (runCampaignRecurringDispatch in src/pages/api/cron.ts gates dispatch by
// comparing this directly against now.getUTCHours()) — it is genuinely UTC,
// not just mislabeled. These helpers convert between that stored UTC value
// and the browser's local time, since admins pick and read this time
// locally, not in UTC. They must run client-side: the local-time
// conversions rely on the multi-arg Date constructor, which is interpreted
// using whatever timezone the executing runtime is in.

function utcHHMMToLocalDate(hhmm: string): Date {
  const [hh, mm] = hhmm.split(":").map(Number);
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hh, mm));
}

// For read-only display, e.g. "7:00 AM".
export function formatUtcTimeOfDayLocal(hhmm: string | null | undefined): string {
  if (!hhmm) return "—";
  const [hh, mm] = hhmm.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return hhmm;
  return utcHHMMToLocalDate(hhmm).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Formats a plain "HH:MM" string as a friendly "7:00 AM"-style string with
// NO timezone conversion — for echoing a value that's already in whatever
// timezone the caller cares about back to the user (e.g. the local value
// currently sitting in an <input type="time">, before it's ever converted
// to UTC for storage).
export function formatHHMM(hhmm: string): string {
  const [hh, mm] = hhmm.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return hhmm;
  return new Date(2000, 0, 1, hh, mm).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// For populating an <input type="time"> (which needs 24-hour "HH:MM") from
// a stored UTC value.
export function utcTimeOfDayToLocalHHMM(hhmm: string | null | undefined): string {
  if (!hhmm) return "07:00";
  const [hh, mm] = hhmm.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "07:00";
  const d = utcHHMMToLocalDate(hhmm);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Inverse: takes a local "HH:MM" (from that same <input type="time">) and
// returns the UTC "HH:MM" to store. The specific calendar day used to
// compute the offset doesn't matter for the once-a-day dispatch cadence
// this drives — only the DST status on the day it's actually saved could
// shift the result by an hour across a DST transition, an acceptable edge
// case for a once-daily send time.
export function parseLocalTimeOfDayToUtc(hhmm: string): string {
  const [hh, mm] = hhmm.split(":").map(Number);
  const now = new Date();
  const localInstant = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
  return `${String(localInstant.getUTCHours()).padStart(2, "0")}:${String(localInstant.getUTCMinutes()).padStart(2, "0")}`;
}
