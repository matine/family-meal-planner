import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signInWithGoogle, safeRedirectPath } from "@/lib/auth";
import { toast } from "sonner";

type LoginSearch = {
  redirect?: string;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — Family Kitchen" }] }),
});

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function LoginPage() {
  const { redirect } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const nextPath = safeRedirectPath(redirect);

  const handleGoogleSignIn = async () => {
    setBusy(true);
    const { error } = await signInWithGoogle(nextPath);
    if (error) {
      toast.error(error.message);
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Family Kitchen</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with your Google account to plan meals, manage your pantry, and shop together.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-12 w-full gap-3 text-base shadow-sm"
          disabled={busy}
          onClick={() => void handleGoogleSignIn()}
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <GoogleIcon className="h-5 w-5" />
          )}
          Continue with Google
        </Button>

        <p className="text-xs text-muted-foreground">
          Only family members with an approved Google account can access this app.
        </p>
      </div>
    </div>
  );
}
