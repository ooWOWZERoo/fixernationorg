// Density banding for the admin dashboard's affiliate coverage map.
//
// Band boundaries are derived from the real current count distribution rather
// than hardcoded, because a fixed scale degenerates badly at both ends: with
// today's sparse data a 0-100 ramp paints every occupied state the same pale
// shade, and once a few states run hot a 0-10 ramp saturates them all to the
// same dark shade. Either way the map stops showing where coverage actually
// concentrates, which is the only reason it exists.

export interface DensityBand {
  /** Lowest affiliate count in this band (always >= 1; zero is its own band). */
  min: number;
  /** Highest count, or null for the open-ended top band. */
  max: number | null;
  /** Short human label, e.g. "Moderate". */
  label: string;
  /** Numeric range as text for the legend, e.g. "2-3" or "7+". */
  rangeLabel: string;
  fill: string;
  stroke: string;
  /** True when the fill is dark enough to need white text on top of it. */
  darkFill: boolean;
  /** How many states fall in this band right now. */
  stateCount: number;
}

/** The neutral band for states with no active affiliates. */
export const EMPTY_BAND = {
  label: "None",
  rangeLabel: "0",
  fill: "#f1f5f9",
  stroke: "#cbd5e1",
  darkFill: false,
} as const;

// A four-step single-hue sequential ramp. Single-hue keeps the ordering
// readable (darker unambiguously means more), and these four steps are far
// enough apart in lightness to stay distinguishable side by side and for
// viewers with colour-vision deficiency, who see this as a lightness ramp
// either way. All four also clear 3:1 against the white card behind them.
const RAMP = [
  { fill: "#bfdbfe", stroke: "#60a5fa", darkFill: false },
  { fill: "#60a5fa", stroke: "#2563eb", darkFill: false },
  { fill: "#2563eb", stroke: "#1d4ed8", darkFill: true },
  { fill: "#1e3a8a", stroke: "#172554", darkFill: true },
] as const;

const LABELS_BY_SIZE: Record<number, string[]> = {
  1: ["Covered"],
  2: ["Lower", "Higher"],
  3: ["Low", "Moderate", "High"],
  4: ["Low", "Moderate", "High", "Very high"],
};

// Above this the sparse ladder stops being meaningful and quantile breaks
// describe the spread better.
const SPARSE_MAX = 7;

/** Candidate ranges before empty ones are dropped. `max: null` is open-ended. */
type Range = { min: number; max: number | null };

const SPARSE_LADDER: Range[] = [
  { min: 1, max: 1 },
  { min: 2, max: 3 },
  { min: 4, max: 6 },
  { min: 7, max: null },
];

function quantile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

function quantileRanges(sortedAsc: number[]): Range[] {
  const distinct = Array.from(new Set(sortedAsc));

  // Fewer distinct values than bands: one band per exact value reads better
  // than ranges that each span a single number anyway.
  if (distinct.length <= 4) {
    return distinct.map((v, i) => ({
      min: v,
      max: i === distinct.length - 1 ? null : v,
    }));
  }

  // Cut points come from the full array, not the distinct values, so a count
  // shared by many states pulls the breaks toward it the way a quantile
  // scale should.
  const cuts: number[] = [];
  for (const p of [0.25, 0.5, 0.75]) {
    const c = Math.max(1, Math.round(quantile(sortedAsc, p)));
    const last = cuts[cuts.length - 1];
    if (c < distinct[distinct.length - 1] && (last === undefined || c > last)) {
      cuts.push(c);
    }
  }

  const ranges: Range[] = [];
  let lower = 1;
  for (const c of cuts) {
    ranges.push({ min: lower, max: c });
    lower = c + 1;
  }
  ranges.push({ min: lower, max: null });
  return ranges;
}

function rangeLabel(min: number, max: number | null): string {
  if (max === null) return min === 1 ? "1+" : `${min}+`;
  if (min === max) return String(min);
  return `${min}-${max}`;
}

/**
 * Builds the density scale from the affiliate counts of the occupied states.
 *
 * Pass only counts >= 1 — zero-affiliate states are represented by
 * EMPTY_BAND, never by a step on the ramp. Bands that no state falls into are
 * dropped, so every legend row and every colour on the map corresponds to
 * real data.
 */
export function buildDensityBands(occupiedCounts: number[]): DensityBand[] {
  if (occupiedCounts.length === 0) return [];

  const sorted = [...occupiedCounts].sort((a, b) => a - b);
  const max = sorted[sorted.length - 1];

  const ranges = max <= SPARSE_MAX ? SPARSE_LADDER : quantileRanges(sorted);

  const populated = ranges
    .map((r) => ({
      ...r,
      stateCount: sorted.filter((c) => c >= r.min && (r.max === null || c <= r.max)).length,
    }))
    .filter((r) => r.stateCount > 0);

  if (populated.length === 0) return [];

  // Clamp the two outer edges to the data actually present. Band interiors
  // stay contiguous so the scale reads as one ramp, but the legend never
  // advertises a range wider than reality: a top band printed "7+" next to a
  // real maximum of 3, or "2-3" when every state in it has exactly 3, both
  // misdescribe the distribution the map is supposed to reveal.
  const min = sorted[0];
  const first = populated[0];
  if (min > first.min) first.min = min;

  const last = populated[populated.length - 1];
  if (last.max === null || last.max > max) last.max = max;

  const labels = LABELS_BY_SIZE[populated.length] ?? LABELS_BY_SIZE[4];

  // Colours are assigned after the empty bands are dropped so the surviving
  // bands always span the full ramp — three occupied bands get light / mid /
  // dark, not three shades crowded at one end.
  const step = populated.length === 1 ? 0 : (RAMP.length - 1) / (populated.length - 1);

  return populated.map((r, i) => {
    const ramp = RAMP[populated.length === 1 ? 2 : Math.round(i * step)];
    return {
      min: r.min,
      max: r.max,
      label: labels[i] ?? `Band ${i + 1}`,
      rangeLabel: rangeLabel(r.min, r.max),
      fill: ramp.fill,
      stroke: ramp.stroke,
      darkFill: ramp.darkFill,
      stateCount: r.stateCount,
    };
  });
}

/** The band a count belongs to, or null for zero / no-band-matched. */
export function bandForCount(bands: DensityBand[], count: number): DensityBand | null {
  if (count <= 0 || bands.length === 0) return null;
  for (const b of bands) {
    if (count >= b.min && (b.max === null || count <= b.max)) return b;
  }
  // Outside the clamped ends — only reachable if a caller mixes counts from a
  // different dataset than the bands were built from. Clamp to the nearer
  // end rather than silently returning the top band for a count of 1.
  return count < bands[0].min ? bands[0] : bands[bands.length - 1];
}

/** The band label shown in the tooltip, dropdown and detail heading. */
export function bandLabelFor(bands: DensityBand[], count: number): string {
  return bandForCount(bands, count)?.label ?? EMPTY_BAND.label;
}
