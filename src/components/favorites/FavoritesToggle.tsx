export type FavoritesView = "all" | "favorites";

interface FavoritesToggleProps {
  view: FavoritesView;
  onChange: (view: FavoritesView) => void;
}

const OPTIONS: { value: FavoritesView; label: string }[] = [
  { value: "all", label: "All" },
  { value: "favorites", label: "Favorites" },
];

export function FavoritesToggle({ view, onChange }: FavoritesToggleProps) {
  return (
    <div role="group" aria-label="View" className="inline-flex gap-2">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={view === o.value}
          className={[
            "min-h-[44px] rounded-full px-5 py-2.5 text-sm font-bold transition-colors",
            view === o.value
              ? "bg-navy text-white"
              : "bg-white text-ink-soft shadow-[0_6px_16px_-10px_rgba(20,40,56,0.25)] hover:text-navy",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
