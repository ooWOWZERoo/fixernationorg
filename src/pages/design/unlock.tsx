import { useState, type FormEvent } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";

export default function DesignUnlockPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const res = await fetch("/api/design/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      const from =
        typeof router.query.from === "string" ? router.query.from : "/design";
      router.push(from);
    } else {
      setError("Wrong password. Try again.");
      setIsLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Design Preview — Fixer Nation</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div
        id="main-content"
        className="min-h-screen bg-slate-950 flex items-center justify-center px-4"
      >
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

          <form
            onSubmit={handleSubmit}
            className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4"
          >
            {error && <Alert variant="error">{error}</Alert>}

            <Input
              label="Password"
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
              disabled={!password}
            >
              Unlock preview
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
