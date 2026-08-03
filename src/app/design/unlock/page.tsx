import { Suspense } from "react";
import { UnlockForm } from "./UnlockForm";

export default function DesignUnlockPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-600/10 mb-4">
            <svg
              className="w-6 h-6 text-brand-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white">Design Preview</h1>
          <p className="text-sm text-slate-400 mt-1">
            Enter the preview password to continue
          </p>
        </div>

        <Suspense>
          <UnlockForm />
        </Suspense>
      </div>
    </div>
  );
}
