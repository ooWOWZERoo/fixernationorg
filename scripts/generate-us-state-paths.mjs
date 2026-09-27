// Regenerates src/lib/us-state-paths.ts — the pre-projected SVG outlines for
// the 50 states plus DC used by the admin dashboard's affiliate coverage map.
//
// Run with: node scripts/generate-us-state-paths.mjs
//
// The projection is done here, at authoring time, rather than in the page's
// getServerSideProps. Next.js serializes getServerSideProps output into
// __NEXT_DATA__ *and* renders it into the HTML, so returning ~108KB of path
// strings as props would ship them twice on every dashboard load. Generating
// once into a committed module puts them in a cacheable JS chunk instead
// (~27KB gzipped), and keeps d3-geo, topojson-client and us-atlas as
// build-time-only devDependencies that never enter the runtime bundle.
//
// Source data is us-atlas states-10m.json (public domain, U.S. Census
// Bureau cartographic boundaries at 1:10m).

import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { feature } from "topojson-client";
import { geoAlbersUsa, geoPath } from "d3-geo";

const require = createRequire(import.meta.url);
const topology = require("us-atlas/states-10m.json");

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../src/lib/us-state-paths.ts");

const VIEWBOX_WIDTH = 960;
const VIEWBOX_HEIGHT = 600;
const PADDING = 8;

// Abbreviation lookup keyed by the full state name us-atlas carries in
// properties.name. geoAlbersUsa has no projection domain for Puerto Rico,
// Guam, American Samoa, the U.S. Virgin Islands or the Northern Mariana
// Islands, so those five of the topology's 56 geometries produce a null path
// and drop out on their own — but they are left out of this map explicitly so
// the count is asserted rather than assumed.
const NAME_TO_ABBR = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR",
  California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE",
  "District of Columbia": "DC", Florida: "FL", Georgia: "GA", Hawaii: "HI",
  Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS",
  Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM",
  "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH",
  Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX",
  Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA",
  "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

const collection = feature(topology, topology.objects.states);

// fitExtent is computed against the full collection so the 51 shapes keep
// their real relative positions; filtering first would re-fit the remainder
// and shift everything.
const projection = geoAlbersUsa().fitExtent(
  [
    [PADDING, PADDING],
    [VIEWBOX_WIDTH - PADDING, VIEWBOX_HEIGHT - PADDING],
  ],
  collection
);

// digits(0) rounds path coordinates to whole units of a 960x600 viewBox.
// Sub-unit detail is invisible at any size this renders at and costs ~50KB.
const path = geoPath(projection).digits(0);

// An inline count label needs roughly 22x14 units of interior room. States
// below that (DC, RI, DE, CT, NJ, NH, VT, MA, MD, HI) get no on-map number
// and surface their count through the tooltip, the dropdown and the legend
// summary instead, all of which carry it as text.
const LABEL_MIN_WIDTH = 26;
const LABEL_MIN_HEIGHT = 18;

const rows = [];

for (const f of collection.features) {
  const name = f.properties?.name;
  const abbr = NAME_TO_ABBR[name];
  if (!abbr) continue;

  const d = path(f);
  if (!d) {
    throw new Error(`No projected path for ${name} — check the topology source.`);
  }

  const [cx, cy] = path.centroid(f);
  const [[x0, y0], [x1, y1]] = path.bounds(f);
  const roomy = x1 - x0 >= LABEL_MIN_WIDTH && y1 - y0 >= LABEL_MIN_HEIGHT;

  rows.push({
    abbr,
    name,
    d,
    cx: Math.round(cx * 10) / 10,
    cy: Math.round(cy * 10) / 10,
    roomy,
  });
}

if (rows.length !== 51) {
  throw new Error(`Expected 51 shapes (50 states + DC), generated ${rows.length}.`);
}

rows.sort((a, b) => a.name.localeCompare(b.name));

const banner = `// GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/generate-us-state-paths.mjs
//
// Pre-projected SVG outlines for the 50 U.S. states plus the District of
// Columbia, in a ${VIEWBOX_WIDTH}x${VIEWBOX_HEIGHT} viewBox. Source: us-atlas states-10m.json
// (public domain, U.S. Census Bureau 1:10m cartographic boundaries),
// projected with d3-geo's geoAlbersUsa — which insets Alaska and Hawaii so
// all 51 shapes fit one frame.
//
// See the generator script for why this is committed rather than computed
// per request.
`;

const body = `
export const US_MAP_VIEWBOX = { width: ${VIEWBOX_WIDTH}, height: ${VIEWBOX_HEIGHT} } as const;

export interface UsStateShape {
  /** Two-letter postal abbreviation — the key Territory.state is stored under. */
  abbr: string;
  /** Full state name, as shown in the tooltip, dropdown and detail heading. */
  name: string;
  /** SVG path "d" attribute in US_MAP_VIEWBOX coordinates. */
  d: string;
  /** Projected centroid, for positioning an inline label. */
  cx: number;
  cy: number;
  /** False when the shape is too small to fit a legible inline count label. */
  roomy: boolean;
}

export const US_STATE_SHAPES: readonly UsStateShape[] = [
${rows
  .map(
    (r) =>
      `  { abbr: "${r.abbr}", name: ${JSON.stringify(r.name)}, cx: ${r.cx}, cy: ${r.cy}, roomy: ${r.roomy}, d: "${r.d}" },`
  )
  .join("\n")}
];
`;

writeFileSync(OUT, `${banner}${body}`, "utf8");

const bytes = Buffer.byteLength(`${banner}${body}`);
console.log(
  `Wrote ${rows.length} state shapes to src/lib/us-state-paths.ts (${(bytes / 1024).toFixed(1)}KB)`
);
