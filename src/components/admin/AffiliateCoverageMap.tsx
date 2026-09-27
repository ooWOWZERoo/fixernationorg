import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import {
  bandForCount,
  buildDensityBands,
  EMPTY_BAND,
  type DensityBand,
} from "@/lib/affiliate-map";
import { US_MAP_VIEWBOX, US_STATE_SHAPES } from "@/lib/us-state-paths";

export interface StateAffiliate {
  /** AffiliateAssignment.id — the key /admin/affiliates/[id] resolves. */
  assignmentId: string;
  name: string;
  /** Approved ACTIVE counties this affiliate holds in this state. */
  counties: string[];
  status: string;
}

interface Props {
  /** Active affiliates keyed by two-letter state abbreviation. */
  affiliatesByState: Record<string, StateAffiliate[]>;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber/20 text-amber-dark",
  ACTIVE: "bg-green-100 text-green-700",
  ON_HOLD: "bg-blue-100 text-blue-700",
  SUSPENDED: "bg-orange-100 text-orange-700",
  REVOKED: "bg-slate-100 text-slate-500",
  CLOSED: "bg-slate-100 text-slate-400",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  SUSPENDED: "Suspended",
  REVOKED: "Revoked",
  CLOSED: "Closed",
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default function AffiliateCoverageMap({ affiliatesByState }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  // One piece of state for both pointer hover and keyboard focus, so the
  // tooltip behaves identically either way instead of hover being a CSS
  // effect the keyboard can't reach.
  const [active, setActive] = useState<string | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  const view = useMemo(() => {
    // The per-state list is the single source of truth for the count, so the
    // number in the tooltip can't drift from the number of rows in the
    // detail list below.
    const countFor = (abbr: string) => affiliatesByState[abbr]?.length ?? 0;

    const occupied = US_STATE_SHAPES.map((s) => countFor(s.abbr)).filter((c) => c > 0);
    const bands = buildDensityBands(occupied);

    const states = US_STATE_SHAPES.map((shape) => {
      const count = countFor(shape.abbr);
      const band = bandForCount(bands, count);
      return {
        ...shape,
        count,
        band,
        bandLabel: band?.label ?? EMPTY_BAND.label,
        fill: band?.fill ?? EMPTY_BAND.fill,
        stroke: band?.stroke ?? EMPTY_BAND.stroke,
        darkFill: band?.darkFill ?? EMPTY_BAND.darkFill,
      };
    });

    // An affiliate holding counties in two states is one affiliate on the
    // map but two per-state entries, so the headline figure dedupes by
    // assignment id rather than summing the per-state counts.
    const distinctAffiliates = new Set(
      Object.values(affiliatesByState).flatMap((rows) => rows.map((r) => r.assignmentId))
    ).size;

    return {
      bands,
      states,
      byAbbr: new Map(states.map((s) => [s.abbr, s])),
      coveredStates: occupied.length,
      distinctAffiliates,
    };
  }, [affiliatesByState]);

  const activeState = active ? view.byAbbr.get(active) : undefined;
  const selectedState = selected ? view.byAbbr.get(selected) : undefined;
  const selectedRows = selected ? affiliatesByState[selected] ?? [] : [];

  const toggle = (abbr: string) => setSelected((cur) => (cur === abbr ? null : abbr));

  return (
    <div className="mb-8 rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Affiliate Coverage</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {view.distinctAffiliates === 0
              ? "No active affiliates hold a territory yet."
              : `${plural(view.distinctAffiliates, "active affiliate")} across ${plural(
                  view.coveredStates,
                  "state"
                )}.`}
          </p>
        </div>
        <Link
          href="/admin/territories"
          className="text-xs font-medium text-navy no-underline hover:text-navy-dark"
        >
          Manage territories →
        </Link>
      </div>

      <div className="px-5 py-5">
        {/* Dropdown first in the DOM: on a phone the state shapes are too
            small to tap accurately, and this is the primary control there. */}
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <label
              htmlFor="affiliate-map-state"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400"
            >
              Jump to state
            </label>
            <select
              id="affiliate-map-state"
              ref={selectRef}
              value={selected ?? ""}
              onChange={(e) => setSelected(e.target.value || null)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              <option value="">Pick a state to see its affiliates</option>
              {view.states.map((s) => (
                <option key={s.abbr} value={s.abbr}>
                  {s.count === 0
                    ? `${s.name} (no affiliates)`
                    : `${s.name} (${plural(s.count, "affiliate")}, ${s.bandLabel.toLowerCase()})`}
                </option>
              ))}
            </select>
          </div>
          {selected && (
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                selectRef.current?.focus();
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Clear selection
            </button>
          )}
        </div>

        <div className="relative">
          <svg
            viewBox={`0 0 ${US_MAP_VIEWBOX.width} ${US_MAP_VIEWBOX.height}`}
            className="h-auto w-full"
            aria-label="Affiliate coverage by U.S. state. Select a state to list its affiliates."
          >
            <g>
              {view.states.map((s) => {
                const isSelected = s.abbr === selected;
                return (
                  <path
                    key={s.abbr}
                    d={s.d}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-label={`${s.name}: ${
                      s.count === 0 ? "no affiliates" : plural(s.count, "affiliate")
                    }, ${s.bandLabel} coverage`}
                    fill={s.fill}
                    stroke={s.stroke}
                    strokeWidth={0.75}
                    className="cursor-pointer outline-none transition-opacity hover:opacity-80"
                    onMouseEnter={() => setActive(s.abbr)}
                    onMouseLeave={() => setActive((cur) => (cur === s.abbr ? null : cur))}
                    onFocus={() => setActive(s.abbr)}
                    onBlur={() => setActive((cur) => (cur === s.abbr ? null : cur))}
                    onClick={() => toggle(s.abbr)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(s.abbr);
                      }
                    }}
                  />
                );
              })}
            </g>

            {/* Counts drawn on the states with room for them. Redundant with
                the tooltip and the dropdown, both of which carry the number
                as text for the small states that get no label here. */}
            <g aria-hidden="true" pointerEvents="none">
              {view.states
                .filter((s) => s.count > 0 && s.roomy)
                .map((s) => (
                  <text
                    key={s.abbr}
                    x={s.cx}
                    y={s.cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={13}
                    fontWeight={700}
                    fill={s.darkFill ? "#ffffff" : "#1e3a8a"}
                  >
                    {s.count}
                  </text>
                ))}
            </g>

            {/* Outlines are re-drawn on top because SVG paints in document
                order — a neighbour drawn later would otherwise clip the
                thick stroke of a hovered or selected state. */}
            {activeState && activeState.abbr !== selected && (
              <path
                d={activeState.d}
                fill="none"
                stroke="#0f172a"
                strokeWidth={1.75}
                pointerEvents="none"
                aria-hidden="true"
              />
            )}
            {selectedState && (
              <path
                d={selectedState.d}
                fill="none"
                stroke="#0f172a"
                strokeWidth={3}
                pointerEvents="none"
                aria-hidden="true"
              />
            )}
          </svg>

          {activeState && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs leading-tight text-white shadow-lg"
              style={{
                left: `${(activeState.cx / US_MAP_VIEWBOX.width) * 100}%`,
                top: `${(activeState.cy / US_MAP_VIEWBOX.height) * 100}%`,
                // Flip below the centroid for northern states, where an
                // upward tooltip would sit outside the card.
                transform:
                  activeState.cy < 90
                    ? "translate(-50%, 0.75rem)"
                    : "translate(-50%, calc(-100% - 0.5rem))",
              }}
            >
              <p className="font-semibold">{activeState.name}</p>
              <p className="text-slate-300">
                {activeState.count === 0 ? "No affiliates" : plural(activeState.count, "affiliate")}
                {" · "}
                {activeState.bandLabel}
              </p>
            </div>
          )}
        </div>

        {/* Legend — every swatch carries its real numeric range as text. */}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Affiliates per state
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li className="flex items-center gap-2">
              <span
                className="h-3.5 w-3.5 shrink-0 rounded border"
                style={{ backgroundColor: EMPTY_BAND.fill, borderColor: EMPTY_BAND.stroke }}
              />
              <span className="text-xs text-slate-600">
                <span className="font-semibold text-slate-700">0</span> · none
              </span>
            </li>
            {view.bands.map((band: DensityBand) => (
              <li key={band.rangeLabel} className="flex items-center gap-2">
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded border"
                  style={{ backgroundColor: band.fill, borderColor: band.stroke }}
                />
                <span className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">{band.rangeLabel}</span> ·{" "}
                  {band.label.toLowerCase()}{" "}
                  <span className="text-slate-400">({plural(band.stateCount, "state")})</span>
                </span>
              </li>
            ))}
          </ul>
          {view.bands.length > 0 && (
            <p className="mt-2 text-xs text-slate-400">
              Shades are set from the current spread of counts, not a fixed scale.
            </p>
          )}
        </div>
      </div>

      {/* Detail list, directly below the map inside the same widget. */}
      <div className="border-t border-slate-100">
        {!selectedState ? (
          <p className="px-5 py-6 text-sm text-slate-400">
            Pick a state on the map or from the dropdown to see who covers it.
          </p>
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-700">
                Showing: {selectedState.name}{" "}
                <span className="font-normal text-slate-400">
                  ({selectedRows.length === 0
                    ? "no affiliates"
                    : `${plural(selectedRows.length, "affiliate")} · ${selectedState.bandLabel}`}
                  )
                </span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  selectRef.current?.focus();
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Clear
              </button>
            </div>

            {selectedRows.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-slate-500">
                No affiliates in {selectedState.name} yet. Assign a territory there to add one.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-y border-slate-100 bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Affiliate
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Counties in {selectedState.name}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedRows.map((row) => (
                      <tr key={row.assignmentId} className="transition-colors hover:bg-slate-50">
                        <td className="px-4 py-3.5">
                          <Link
                            href={`/admin/affiliates/${row.assignmentId}`}
                            className="font-semibold text-navy no-underline hover:text-navy-dark hover:underline"
                          >
                            {row.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {row.counties.length === 0 ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            row.counties.join(", ")
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              STATUS_BADGE[row.status] ?? "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {STATUS_LABEL[row.status] ?? row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
