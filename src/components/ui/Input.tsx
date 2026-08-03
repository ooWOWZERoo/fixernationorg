"use client";

import { type InputHTMLAttributes, forwardRef, useId } from "react";
import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, description, error, className, id: idProp, ...props }, ref) => {
    const generatedId = useId();
    const id = idProp ?? generatedId;
    const descId = description ? `${id}-desc` : undefined;
    const errId = error ? `${id}-err` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {label}
            {props.required && (
              <span className="ml-1 text-red-500" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        {description && (
          <p
            id={descId}
            className="text-xs text-slate-500 dark:text-slate-400"
          >
            {description}
          </p>
        )}

        <input
          ref={ref}
          id={id}
          aria-describedby={
            [descId, errId].filter(Boolean).join(" ") || undefined
          }
          aria-invalid={!!error}
          className={twMerge(
            clsx(
              "block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors",
              "placeholder:text-slate-400 dark:placeholder:text-slate-600",
              "focus:outline-none focus:ring-2 focus:ring-offset-0",
              error
                ? "border-red-300 text-red-900 focus:border-red-400 focus:ring-red-200 " +
                  "dark:border-red-700 dark:text-red-200 dark:focus:ring-red-900/40"
                : "border-slate-300 text-slate-900 focus:border-brand-400 focus:ring-brand-200 " +
                  "dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-brand-900/40",
              "disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-900",
              className
            )
          )}
          {...props}
        />

        {error && (
          <p
            id={errId}
            role="alert"
            className="text-xs text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
