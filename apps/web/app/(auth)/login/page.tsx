"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";

const isDev = process.env.NODE_ENV === "development";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}


export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await signIn("nodemailer", { email, callbackUrl: "/dashboard" });
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: string) => {
    setError(null);
    try {
      await signIn(provider, { callbackUrl: "/dashboard" });
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  const handleDevLogin = async () => {
    setDevLoading(true);
    setError(null);
    try {
      // redirect: true navigates the browser — this won't return on success.
      // On failure, signIn throws or the redirect goes to /login?error=...
      await signIn("dev-credentials", {
        email: "dev@mach-zero.dev",
        callbackUrl: "/dashboard",
        redirect: true,
      });
    } catch {
      setError("Dev login failed. Make sure the database is seeded.");
      setDevLoading(false);
    }
  };

  return (
    <Card className="w-full border-border/50 shadow-2xl">
      <CardContent className="p-8">
        {/* Logo & heading */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <span className="text-lg font-bold text-primary-foreground">
              M0
            </span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Log in or sign up
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use your email or another service to continue
            <br />
            with Mach-Zero.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Dev login — only shown in development */}
        {isDev && (
          <>
            <button
              onClick={handleDevLogin}
              disabled={devLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-500/50 bg-blue-500/10 px-4 py-3 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/20 active:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 18l6-6-6-6M8 6l-6 6 6 6" />
              </svg>
              {devLoading ? "Signing in..." : "Dev Login (SUPER_ADMIN)"}
            </button>
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                or use production auth
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        {/* Social login buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handleOAuthSignIn("google")}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 active:bg-zinc-100"
          >
            <GoogleIcon className="h-5 w-5" />
            Continue with Google
          </button>

        </div>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            or
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Email login */}
        <form onSubmit={handleEmailSignIn} className="space-y-3">
          <input
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Sending link..." : "Continue with email"}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          By continuing, you agree to the terms of service.
          <br />
          No password needed — we&apos;ll email you a magic link.
        </p>
      </CardContent>
    </Card>
  );
}
