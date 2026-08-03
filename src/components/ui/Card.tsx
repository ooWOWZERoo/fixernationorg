import { type HTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        clsx(
          "rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900",
          className
        )
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={twMerge(clsx("px-6 pt-6 pb-0", className))} {...props} />
  );
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={twMerge(
        clsx(
          "text-base font-semibold text-slate-900 dark:text-slate-100",
          className
        )
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={twMerge(
        clsx("text-sm text-slate-500 dark:text-slate-400 mt-1", className)
      )}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={twMerge(clsx("px-6 py-4", className))} {...props} />
  );
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={twMerge(
        clsx(
          "px-6 pb-6 pt-0 flex items-center gap-3",
          className
        )
      )}
      {...props}
    />
  );
}
