export default function ComingSoonPage() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 text-center"
    >
      <div className="max-w-md space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-600/10 border border-brand-600/20 text-brand-400 text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
          Stage 0 — Foundation
        </div>

        <h1 className="text-4xl font-bold text-white tracking-tight">
          Fixer Nation
        </h1>

        <p className="text-lg text-slate-400 leading-relaxed">
          We&apos;re rebuilding from the ground up. Something real is on the way.
        </p>

        <p className="text-sm text-slate-600">
          fixernation.org
        </p>
      </div>
    </main>
  );
}
