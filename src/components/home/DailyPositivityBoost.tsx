import { useEffect, useRef, useState } from "react";

export interface DailyPositivityBoostProps {
  content: string;
  category: string | null;
  isFallback: boolean;
}

export function DailyPositivityBoost({ content }: DailyPositivityBoostProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-boost-reveal
      data-visible={visible}
      className="relative overflow-hidden rounded-2xl px-8 py-14 text-center shadow-[0_4px_32px_-4px_rgba(31,58,84,0.10)] sm:px-16"
      style={{
        background:
          "radial-gradient(ellipse at 12% 60%, rgba(242,169,60,0.13) 0%, transparent 48%), radial-gradient(ellipse at 88% 20%, rgba(140,158,164,0.11) 0%, transparent 44%), #FAF9F6",
      }}
    >
      <h2 className="sr-only">Your Daily Positivity Boost</h2>
      <span className="eyebrow">Your Daily Positivity Boost</span>
      <p className="mt-3 text-sm text-ink-soft">A little something positive for today.</p>
      <p className="mx-auto mt-6 max-w-2xl font-display text-2xl font-normal leading-snug text-navy sm:text-3xl">
        {content}
      </p>
      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        New positivity, every day.
      </p>
    </div>
  );
}
