import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  readAt: string | null
  createdAt: string
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

// Bell icon + unread badge + a simple dropdown, rendered in the shared
// SiteHeader so it shows up for any signed-in member across the whole
// site (not just one page).
export function NotificationBell() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState<NotificationItem[]>([])
  const buttonRef = useRef<HTMLButtonElement>(null)

  const fetchUnread = useCallback(() => {
    fetch("/api/account/notifications/unread-count")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setUnreadCount(d.count)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!session) return
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [session, fetchUnread])

  async function handleToggle() {
    const willOpen = !open
    setOpen(willOpen)
    if (willOpen && !loaded) {
      try {
        const res = await fetch("/api/account/notifications")
        const data = await res.json()
        if (res.ok) setItems(data.notifications ?? [])
      } catch {
        // best effort
      }
      setLoaded(true)
    }
  }

  function handleItemClick(item: NotificationItem) {
    if (!item.readAt) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, readAt: new Date().toISOString() } : i)))
      setUnreadCount((c) => Math.max(0, c - 1))
      fetch(`/api/account/notifications/${item.id}/read`, { method: "POST" }).catch(() => {})
    }
    setOpen(false)
  }

  function handleMarkAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })))
    setUnreadCount(0)
    fetch("/api/account/notifications/mark-all-read", { method: "POST" }).catch(() => {})
  }

  function closeAndRefocus() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeAndRefocus()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open])

  if (!session) return null

  const bellLabel = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-label={bellLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="tb-notification-panel"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-navy hover:bg-navy/6"
      >
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10 2a6 6 0 00-6 6v2.586l-1.707 1.707A1 1 0 003 14h14a1 1 0 00.707-1.707L16 10.586V8a6 6 0 00-6-6zM8.5 16a1.5 1.5 0 003 0h-3z" />
        </svg>
        {unreadCount > 0 && (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber px-1 text-[10px] font-bold text-navy-dark">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      <span className="sr-only" aria-live="polite">
        {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : ""}
      </span>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={closeAndRefocus} />
          <div
            id="tb-notification-panel"
            role="dialog"
            aria-label="Notifications"
            onKeyDown={(e) => { if (e.key === "Escape") closeAndRefocus() }}
            className="absolute right-0 z-20 mt-1 w-80 overflow-hidden rounded-2xl border border-navy/6 bg-white shadow-[0_24px_50px_-20px_rgba(20,40,56,0.35)]"
          >
            <div className="flex items-center justify-between border-b border-navy/8 px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-widest text-ink-soft/60">Notifications</span>
              {unreadCount > 0 && (
                <button type="button" onClick={handleMarkAllRead} className="text-xs font-semibold text-amber-dark hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-ink-soft">Nothing new yet.</p>
              ) : (
                items.map((item) => {
                  const content = (
                    <div className={`px-4 py-3 text-sm ${!item.readAt ? "bg-amber/5" : ""}`}>
                      <p className="font-semibold text-navy">{item.title}</p>
                      <p className="mt-0.5 text-ink-soft">{item.body}</p>
                      <p className="mt-1 text-[11px] text-ink-soft/60">{relativeTime(item.createdAt)}</p>
                    </div>
                  )
                  return item.link ? (
                    <Link key={item.id} href={item.link} className="block no-underline hover:bg-cream-panel" onClick={() => handleItemClick(item)}>
                      {content}
                    </Link>
                  ) : (
                    <button
                      key={item.id}
                      type="button"
                      className="block w-full text-left hover:bg-cream-panel"
                      onClick={() => handleItemClick(item)}
                    >
                      {content}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
