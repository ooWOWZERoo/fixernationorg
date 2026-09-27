// The 50 U.S. states plus the District of Columbia — abbreviations, ordered
// alphabetically by full state name (the order the three separate copies of
// this list used before SP-74 consolidated them here).
//
// Deliberately split out from us-geo.ts: the public become-an-affiliate and
// become-an-ambassador forms need only this list, and importing them from a
// module that also holds the 3,143-county dataset would drag ~50KB of county
// names into those pages' client bundles.

export const US_STATES: string[] = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

export const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  DC: "District of Columbia",
};

const ABBR_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATE_NAMES).map(([abbr, name]) => [name.toLowerCase(), abbr])
);

/**
 * Normalizes a stored state value to its two-letter abbreviation, or null if
 * it isn't one of the 51 jurisdictions.
 *
 * SP-74 onward writes Territory.state as an uppercase abbreviation, but rows
 * created by the admin's own territory form before that are free text and can
 * hold a full state name, odd casing, or a region like "Southeast" that maps
 * to no single state.
 */
export function normalizeStateAbbr(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  if (US_STATE_NAMES[upper]) return upper;

  return ABBR_BY_NAME[trimmed.toLowerCase()] ?? null;
}

