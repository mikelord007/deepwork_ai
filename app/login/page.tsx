"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function LoginContent() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        window.location.href = next;
      }
    });
    return () => subscription.unsubscribe();
  }, [next]);

  const handleSignInWithGoogle = async () => {
    if (!supabase) return;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  };

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="flex justify-center">
          <img src="/logo.svg" alt="" className="w-12 h-12" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-semibold text-foreground">
            Sign in to deepwork.ai
          </h1>
          <p className="mt-2 text-sm text-muted">
            Use your Google account to get started.
          </p>
        </div>
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Sign-in failed. Please try again.
          </p>
        )}
        <button
          type="button"
          onClick={handleSignInWithGoogle}
          className="btn-primary w-full inline-flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>
        <a href="/" className="block text-sm text-muted hover:text-foreground transition-colors">
          Back to home
        </a>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background flex items-center justify-center text-muted">Loading...</main>}>
      <LoginContent />
    </Suspense>
  );
}
