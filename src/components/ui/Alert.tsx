import { type HTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";

export type AlertVariant = "info" | "success" | "warning" | "error";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
}

const styles: Record<
  AlertVariant,
  { wrapper: string; icon: string; title: string; body: string; iconPath: string }
> = {
  info: {
    wrapper:
      "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40",
    icon: "text-blue-500",
    title: "text-blue-800 dark:text-blue-200",
    body: "text-blue-700 dark:text-blue-300",
    iconPath:
      "M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-.5-6v2h1v-2h-1zm0-8v6h1V8h-1z",
  },
  success: {
    wrapper:
      "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/40",
    icon: "text-green-500",
    title: "text-green-800 dark:text-green-200",
    body: "text-green-700 dark:text-green-300",
    iconPath:
      "M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7l-3-3 1.414-1.414L11 12.172l5.586-5.586L18 8l-7 7z",
  },
  warning: {
    wrapper:
      "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40",
    icon: "text-amber-500",
    title: "text-amber-800 dark:text-amber-200",
    body: "text-amber-700 dark:text-amber-300",
    iconPath:
      "M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z",
  },
  error: {
    wrapper:
      "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/40",
    icon: "text-red-500",
    title: "text-red-800 dark:text-red-200",
    body: "text-red-700 dark:text-red-300",
    iconPath:
      "M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z",
  },
};

export function Alert({
  variant = "info",
  title,
  className,
  children,
  ...props
}: AlertProps) {
  const s = styles[variant];
  return (
    <div
      role="alert"
      className={twMerge(
        clsx("flex gap-3 rounded-lg border p-4", s.wrapper, className)
      )}
      {...props}
    >
      <svg
        className={clsx("mt-0.5 w-5 h-5 shrink-0", s.icon)}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d={s.iconPath} />
      </svg>
      <div className="min-w-0 flex-1 text-sm">
        {title && (
          <p className={clsx("font-semibold mb-0.5", s.title)}>{title}</p>
        )}
        <div className={s.body}>{children}</div>
      </div>
    </div>
  );
}
