import { useMemo } from "react";
import { US_STATES, US_STATE_NAMES, countiesForState } from "@/lib/us-geo";

interface Props {
  state: string;
  county: string;
  /** Called with the full next pair — county is cleared whenever state changes. */
  onChange: (next: { state: string; county: string }) => void;
  idPrefix?: string;
  stateLabel?: string;
  countyLabel?: string;
  required?: boolean;
  disabled?: boolean;
  /** Defaults match the admin form styling; account pages pass their own. */
  labelClassName?: string;
  selectClassName?: string;
}

const DEFAULT_LABEL =
  "block text-xs font-semibold text-slate-600 mb-1";
const DEFAULT_SELECT =
  "w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy";

// Both dropdowns are sorted alphabetically: states by their full name (the
// order US_STATES is already stored in), counties by name from the shared
// dataset. Picking a new state clears the county rather than leaving a
// county from the previous state selected — that pairing would fail the
// server-side validation in a way nobody could see on screen.
export function StateCountySelect({
  state,
  county,
  onChange,
  idPrefix = "territory",
  stateLabel = "State",
  countyLabel = "County",
  required = false,
  disabled = false,
  labelClassName = DEFAULT_LABEL,
  selectClassName = DEFAULT_SELECT,
}: Props) {
  const counties = useMemo(() => (state ? countiesForState(state) : []), [state]);

  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-state`} className={labelClassName}>
          {stateLabel}
          {required ? " *" : ""}
        </label>
        <select
          id={`${idPrefix}-state`}
          required={required}
          disabled={disabled}
          value={state}
          onChange={(e) => onChange({ state: e.target.value, county: "" })}
          className={selectClassName}
        >
          <option value="">— select —</option>
          {US_STATES.map((s) => (
            <option key={s} value={s}>
              {US_STATE_NAMES[s] ? `${s} — ${US_STATE_NAMES[s]}` : s}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-county`} className={labelClassName}>
          {countyLabel}
          {required ? " *" : ""}
        </label>
        <select
          id={`${idPrefix}-county`}
          required={required}
          disabled={disabled || !state}
          value={county}
          onChange={(e) => onChange({ state, county: e.target.value })}
          className={selectClassName}
        >
          <option value="">{state ? "— select —" : "Pick a state first"}</option>
          {counties.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
