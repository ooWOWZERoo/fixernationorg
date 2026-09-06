// Explicit timezone math for "what calendar day is it" in a member's own
// timezone, parameterizing the pattern established in positivityBoost.ts's
// getEtCalendarDate() (which is hardcoded to America/New_York). Used by
// Tune Your Brain features that key on a per-member calendar day (daily
// challenge, streak continuity in a later phase).
export function getMemberCalendarDate(now: Date, timezone: string | null | undefined): Date {
  const tz = timezone || "America/New_York";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const year = Number(parts.find((p) => p.type === "year")!.value);
    const month = Number(parts.find((p) => p.type === "month")!.value);
    const day = Number(parts.find((p) => p.type === "day")!.value);
    return new Date(Date.UTC(year, month - 1, day));
  } catch {
    // A client could theoretically send a garbage timezone string -- never
    // let that throw and break the calling API route.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const year = Number(parts.find((p) => p.type === "year")!.value);
    const month = Number(parts.find((p) => p.type === "month")!.value);
    const day = Number(parts.find((p) => p.type === "day")!.value);
    return new Date(Date.UTC(year, month - 1, day));
  }
}
