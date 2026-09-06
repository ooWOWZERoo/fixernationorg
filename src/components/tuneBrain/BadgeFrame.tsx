import { BadgeIcon, type BadgeIconSize, type BadgeIconState } from "./BadgeIcon"

interface BadgeFrameProps {
  iconKey: string
  name: string
  tier?: string | null
  size?: BadgeIconSize
  state?: BadgeIconState
}

const TIER_LABELS: Record<string, string> = {
  STARTER: "Starter",
  EXPLORER: "Explorer",
  BUILDER: "Builder",
  CHALLENGER: "Challenger",
  SKILLED: "Skilled",
  ADVANCED: "Advanced",
  CHAMPION: "Champion",
}

// Wraps BadgeIcon with the badge's name/tier as surrounding text -- never
// inside the icon itself, per the "no long text inside badges" rule.
export function BadgeFrame({ iconKey, name, tier, size = "sm", state = "earned" }: BadgeFrameProps) {
  return (
    <div className="flex w-20 flex-col items-center gap-1.5 text-center">
      <BadgeIcon iconKey={iconKey} size={size} state={state} />
      <span className={`text-xs font-semibold leading-tight ${state === "locked" ? "text-ink-soft/60" : "text-navy"}`}>
        {name}
      </span>
      {tier && <span className="text-[10px] uppercase tracking-wide text-ink-soft/60">{TIER_LABELS[tier] ?? tier}</span>}
    </div>
  )
}
