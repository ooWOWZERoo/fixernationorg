import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Your email or password is incorrect.",
  EmailNotVerified: "Please verify your email before signing in. Check your inbox for the verification link.",
  InvalidToken: "That link is invalid.",
  ExpiredToken: "That link has expired. Request a new one.",
  Default: "Something went wrong. Try again.",
};

export default function SignInPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [verified, setVerified] = useState(false);

  // Populate error/success from URL params after hydration
  useEffect(() => {
    if (!router.isReady) return;
    const code = typeof router.query.error === "string" ? router.query.error : null;
    if (code) setError(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.Default);
    if (router.query.verified === "1") setVerified(true);
  }, [router.isReady, router.query.error, router.query.verified]);

  async function doSignIn() {
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result) {
        setError("No response from server. Try again.");
        setIsLoading(false);
        return;
      }

      if (result.error) {
        setError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.Default);
        setIsLoading(false);
      } else {
        const callbackUrl =
          typeof router.query.callbackUrl === "string"
            ? router.query.callbackUrl
            : "/";
        router.push(callbackUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error. Try again.");
      setIsLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Sign in — Fixer Nation</title>
      </Head>
      <div
        id="main-content"
        className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12"
      >
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <span className="text-2xl font-bold text-brand-600 tracking-tight">
              Fixer Nation
            </span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <h1 className="text-xl font-semibold text-slate-900 mb-1">
              Sign in to your account
            </h1>
            <p className="text-sm text-slate-500 mb-6">
              Enter your email and password to continue.
            </p>

            {verified && (
              <Alert variant="success" className="mb-5">
                Email verified! You can now sign in.
              </Alert>
            )}
            {error && (
              <Alert variant="error" className="mb-5">
                {error}
              </Alert>
            )}

            <form onSubmit={(e) => { e.preventDefault(); doSignIn(); }} className="space-y-4" noValidate>
              <Input
                label="Email address"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
              <div>
                <Input
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <div className="mt-1 text-right">
                  <Link href="/forgot-password" className="text-xs font-semibold text-slate-500 no-underline hover:text-navy">
                    Forgot password?
                  </Link>
                </div>
              </div>

              <Button
                type="button"
                onClick={doSignIn}
                className="w-full mt-2"
                isLoading={isLoading}
                disabled={isLoading}
              >
                Sign in
              </Button>
            </form>

            <div className="mt-5 pt-5 border-t border-slate-100 text-center text-sm">
              <span className="text-slate-500">New to Fixer Nation? </span>
              <Link href="/register" className="font-semibold text-navy no-underline hover:underline">
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
