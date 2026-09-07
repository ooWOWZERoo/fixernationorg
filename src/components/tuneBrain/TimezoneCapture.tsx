import { useEffect } from "react"

// Fire-and-forget, best-effort timezone capture -- never blocks rendering,
// and only sends once (the caller's getServerSideProps already knows
// whether the member has a stored timezone). Shared across the hub page
// and every per-game page so this only needs to happen once, wherever the
// member happens to land first.
export function TimezoneCapture({ hasTimezone }: { hasTimezone: boolean }) {
  useEffect(() => {
    if (hasTimezone) return
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (timezone) {
        fetch("/api/account/timezone", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ timezone }),
        }).catch(() => {})
      }
    } catch {
      // Best-effort only.
    }
  }, [hasTimezone])

  return null
}
