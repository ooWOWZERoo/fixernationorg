import { db } from "@/lib/db";

const TIMEZONE = "America/New_York";
const REPETITION_PROTECTION_DAYS = 90;

// Last line of defense -- used only if the database itself is unreachable.
// Never let a thrown error reach the homepage; this must always be true
// from the first word to the last, same as every other eligible message.
const HARDCODED_FALLBACK_CONTENT = "Today is another opportunity to create something good.";

export interface TodaysPositivityBoost {
  content: string;
  category: string | null;
  isFallback: boolean;
}

// UTC-midnight Date representing "today" in America/New_York, for use with
// a @db.Date column -- explicit timezone math, since no site-wide "what day
// is it" convention exists elsewhere in this app to reuse.
export function getEtCalendarDate(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);
  const day = Number(parts.find((p) => p.type === "day")!.value);
  return new Date(Date.UTC(year, month - 1, day));
}

function isEligible(boost: { status: string; validationStatus: string }): boolean {
  return boost.status === "ACTIVE" && boost.validationStatus === "PASSED";
}

async function pickEligibleBoostId(displayDate: Date): Promise<string | null> {
  const ninetyDaysAgo = new Date(displayDate.getTime() - REPETITION_PROTECTION_DAYS * 24 * 60 * 60 * 1000);

  // Tier 1: normal pool, excluding anything shown in the last 90 days.
  const fresh = await db.positivityBoost.findMany({
    where: {
      status: "ACTIVE",
      validationStatus: "PASSED",
      assignments: { none: { displayDate: { gte: ninetyDaysAgo } } },
    },
    select: { id: true },
  });
  if (fresh.length > 0) {
    return fresh[Math.floor(Math.random() * fresh.length)].id;
  }

  // Tier 2: pool exhausted -- ignore the 90-day exclusion, prefer whatever
  // was shown longest ago (or never shown).
  const relaxed = await db.positivityBoost.findMany({
    where: { status: "ACTIVE", validationStatus: "PASSED" },
    orderBy: { lastDisplayedAt: "asc" },
    take: 1,
    select: { id: true },
  });
  if (relaxed.length > 0) return relaxed[0].id;

  // Tier 3: even the normal ACTIVE/PASSED pool is empty -- fall back to the
  // dedicated hard-safe fallback rows specifically, still gated by the same
  // eligibility filter (a fallback row that's been deactivated or hasn't
  // passed validation must not be selectable just because isFallback=true).
  const fallback = await db.positivityBoost.findMany({
    where: { status: "ACTIVE", validationStatus: "PASSED", isFallback: true },
    orderBy: { lastDisplayedAt: "asc" },
    take: 1,
    select: { id: true },
  });
  if (fallback.length > 0) return fallback[0].id;

  return null;
}

export async function getTodaysPositivityBoost(): Promise<TodaysPositivityBoost> {
  try {
    const displayDate = getEtCalendarDate();

    const existing = await db.positivityBoostAssignment.findUnique({
      where: { displayDate },
      include: { positivityBoost: true },
    });
    if (existing) {
      // Re-check current eligibility rather than trusting the relation
      // blindly -- the boost could have been edited/deactivated after the
      // assignment was made. Never re-randomize a replacement; if it's no
      // longer eligible, fall through to the hardcoded fallback.
      if (isEligible(existing.positivityBoost)) {
        return {
          content: existing.positivityBoost.content,
          category: existing.positivityBoost.category,
          isFallback: existing.positivityBoost.isFallback,
        };
      }
      return { content: HARDCODED_FALLBACK_CONTENT, category: null, isFallback: true };
    }

    const chosenId = await pickEligibleBoostId(displayDate);
    if (!chosenId) {
      return { content: HARDCODED_FALLBACK_CONTENT, category: null, isFallback: true };
    }

    let wonRace = false;
    try {
      await db.positivityBoostAssignment.create({
        data: { positivityBoostId: chosenId, displayDate },
      });
      wonRace = true;
    } catch {
      // Unique constraint violation -- another concurrent request already
      // claimed today. Don't inspect the error, just fall through to the
      // shared re-fetch below, matching the RecurrenceRun claim idiom.
    }

    if (wonRace) {
      // Only the winning request updates display stats, so a burst of
      // concurrent requests around midnight can't double-count a single
      // day's assignment.
      await db.positivityBoost.update({
        where: { id: chosenId },
        data: { lastDisplayedAt: new Date(), displayCount: { increment: 1 } },
      });
    }

    const assignment = await db.positivityBoostAssignment.findUnique({
      where: { displayDate },
      include: { positivityBoost: true },
    });
    if (assignment && isEligible(assignment.positivityBoost)) {
      return {
        content: assignment.positivityBoost.content,
        category: assignment.positivityBoost.category,
        isFallback: assignment.positivityBoost.isFallback,
      };
    }

    return { content: HARDCODED_FALLBACK_CONTENT, category: null, isFallback: true };
  } catch {
    return { content: HARDCODED_FALLBACK_CONTENT, category: null, isFallback: true };
  }
}
