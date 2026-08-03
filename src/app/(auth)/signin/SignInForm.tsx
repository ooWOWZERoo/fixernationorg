"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Your email or password is incorrect.",
  EmailNotVerified: "Please verify your email before signing in.",
  Default: "Something went wrong. Try again.",
};

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const errorCode = params.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default) : null
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.Default);
      setIsLoading(false);
    } else {
      router.push(callbackUrl);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">
        Sign in to your account
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Enter your email and password to continue.
      </p>

      {error && (
        <Alert variant="error" className="mb-5">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isLoading}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
        />

        <Button
          type="submit"
          className="w-full mt-2"
          isLoading={isLoading}
          disabled={!email || !password}
        >
          Sign in
        </Button>
      </form>

      <div className="mt-5 pt-5 border-t border-slate-100 text-center text-sm text-slate-500">
        <span className="text-slate-400">
          Password reset and new accounts available at launch.
        </span>
      </div>
    </div>
  );
}
