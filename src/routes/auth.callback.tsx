import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isEmailAllowed, safeRedirectPath } from "@/lib/auth";
import { toast } from "sonner";

type CallbackSearch = {
  redirect?: string;
};

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: AuthCallbackPage,
  head: () => ({ meta: [{ title: "Signing in… — Family Kitchen" }] }),
});

function AuthCallbackPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const handled = useRef(false);
  const nextPath = safeRedirectPath(redirect);

  useEffect(() => {
    const finish = async (email: string | null | undefined) => {
      if (handled.current) return;
      if (!email) return;
      if (!isEmailAllowed(email)) {
        handled.current = true;
        await supabase.auth.signOut();
        toast.error("This Google account is not authorised for this app.");
        void navigate({ to: "/login" });
        return;
      }
      handled.current = true;
      void navigate({ href: nextPath });
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) void finish(session.user.email);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) void finish(session.user.email);
      if (event === "SIGNED_OUT" && !handled.current) {
        handled.current = true;
        toast.error("Sign-in failed. Please try again.");
        void navigate({ to: "/login" });
      }
    });

    const timeout = window.setTimeout(() => {
      if (!handled.current) {
        handled.current = true;
        toast.error("Sign-in timed out. Please try again.");
        void navigate({ to: "/login" });
      }
    }, 15000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [navigate, nextPath]);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-3 px-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      <p className="text-sm text-muted-foreground">Signing you in with Google…</p>
    </div>
  );
}
