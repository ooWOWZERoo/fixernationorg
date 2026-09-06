// Code-first badge artwork -- lightweight inline SVG shapes, no illustration
// pipeline. A distinct shape + a bronze->silver->gold-ish color progression
// per tier (built from colors already in tailwind.config, not new hex
// values). No text is ever rendered inside the icon itself (that lives in
// BadgeFrame, next to the icon).

export type BadgeIconSize = "sm" | "lg"
export type BadgeIconState = "locked" | "earned" | "featured"

interface BadgeIconProps {
  iconKey: string
  size?: BadgeIconSize
  state?: BadgeIconState
  className?: string
}

// One color + shape per tier (1 = STARTER ... 7 = CHAMPION), progressing
// from a muted starter tone through the app's coral/amber accents to a
// deep gold for CHAMPION.
const TIER_COLORS = ["#8C9EA4", "#2C4238", "#1F3A54", "#FF7A59", "#F2A93C", "#D98F1F", "#8d3c06"]
const TIER_SHAPES = ["circle", "leaf", "hex", "shield", "diamond", "bolt", "star"] as const
type ShapeKey = (typeof TIER_SHAPES)[number]

function resolveIcon(iconKey: string): { shape: ShapeKey; color: string } {
  const match = iconKey.match(/-(\d+)$/)
  if (match) {
    const n = Math.min(Math.max(parseInt(match[1], 10), 1), 7)
    return { shape: TIER_SHAPES[n - 1], color: TIER_COLORS[n - 1] }
  }
  // Cross-game / unrecognized keys get a neutral, cohesive default shape
  // rather than a per-tier one.
  return { shape: "star", color: TIER_COLORS[4] }
}

function ShapePath({ shape }: { shape: ShapeKey }) {
  switch (shape) {
    case "circle":
      return <circle cx="32" cy="32" r="22" />
    case "leaf":
      return <path d="M32 8c14 0 22 10 22 24 0 8-8 14-22 14S10 40 10 32C10 18 18 8 32 8z" />
    case "hex":
      return <polygon points="32,6 54,19 54,45 32,58 10,45 10,19" />
    case "shield":
      return <path d="M32 6l22 8v16c0 16-10 26-22 30C20 56 10 46 10 30V14z" />
    case "diamond":
      return <polygon points="32,6 54,32 32,58 10,32" />
    case "bolt":
      return <path d="M34 4L14 34h12l-4 26 24-32H34l4-24z" />
    case "star":
    default:
      return <polygon points="32,4 40,24 62,24 44,37 51,58 32,45 13,58 20,37 2,24 24,24" />
  }
}

export function BadgeIcon({ iconKey, size = "sm", state = "earned", className = "" }: BadgeIconProps) {
  const { shape, color } = resolveIcon(iconKey)
  const dim = size === "lg" ? 64 : 40
  const locked = state === "locked"
  const featured = state === "featured"

  return (
    <svg viewBox="0 0 64 64" width={dim} height={dim} className={className} aria-hidden="true">
      {featured && <circle cx="32" cy="32" r="30" fill="none" stroke="#F2A93C" strokeWidth="3" opacity="0.85" />}
      <g
        fill={locked ? "none" : color}
        stroke={locked ? "#B9C2C8" : "none"}
        strokeWidth={locked ? 2 : 0}
        opacity={locked ? 0.55 : 1}
      >
        <ShapePath shape={shape} />
      </g>
    </svg>
  )
}
