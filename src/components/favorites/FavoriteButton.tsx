import { useState } from "react";
import type { FavoriteType } from "@/lib/favorites-view";

interface FavoriteButtonProps {
  type: FavoriteType;
  itemId: string;
  initialFavorited: boolean;
  variant?: "icon" | "labeled";
  // Lets a list page keep its own copy of the starred ids in sync.
  onChange?: (itemId: string, favorited: boolean) => void;
  className?: string;
}

const ERROR_TEXT = "Couldn't save that. Please try again.";

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8L12 2.5z" />
    </svg>
  );
}

export function FavoriteButton({
  type,
  itemId,
  initialFavorited,
  variant = "icon",
  onChange,
  className = "",
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    // The button can sit inside a clickable card; never trigger its navigation.
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;

    const next = !favorited;
    setFavorited(next);
    onChange?.(itemId, next);
    setError(false);
    setPending(true);

    try {
      const res = await fetch("/api/account/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, itemId, favorited: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setFavorited(!next);
      onChange?.(itemId, !next);
      setError(true);
    } finally {
      setPending(false);
    }
  }

  const labeled = variant === "labeled";

  return (
    <span className={`relative inline-flex flex-col items-start ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={favorited}
        aria-label={labeled ? undefined : favorited ? "Remove from favorites" : "Save to favorites"}
        className={
          labeled
            ? [
                "inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-sm font-bold transition-colors",
                favorited
                  ? "bg-navy text-white"
                  : "bg-white text-ink-soft shadow-[0_6px_16px_-10px_rgba(20,40,56,0.25)] hover:text-navy",
              ].join(" ")
            : [
                "inline-flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[0_6px_16px_-10px_rgba(20,40,56,0.35)] transition-colors",
                favorited ? "text-amber-dark" : "text-ink-soft hover:text-navy",
              ].join(" ")
        }
      >
        <span className={favorited && labeled ? "text-amber" : undefined}>
          <StarIcon filled={favorited} />
        </span>
        {labeled && <span>{favorited ? "Saved" : "Save"}</span>}
      </button>
      {error && (
        <span
          role="alert"
          className={
            labeled
              ? "mt-2 text-xs font-semibold text-red-700"
              : "absolute right-0 top-12 z-10 w-48 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-lg"
          }
        >
          {ERROR_TEXT}
        </span>
      )}
    </span>
  );
}
