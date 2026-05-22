import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isEmailAllowed, signOut as authSignOut } from "@/lib/auth";
import { toast } from "sonner";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function rejectDisallowedUser(user: User | null | undefined): Promise<boolean> {
  if (!user?.email) return false;
  if (isEmailAllowed(user.email)) return false;
  await authSignOut();
  toast.error("This Google account is not authorised for this app.");
  return true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const applySession = async (next: Session | null) => {
      if (next?.user && (await rejectDisallowedUser(next.user))) {
        if (active) setSession(null);
        return;
      }
      if (active) setSession(next);
    };

    void supabase.auth.getSession().then(({ data: { session: initial } }) => {
      void applySession(initial).finally(() => {
        if (active) setLoading(false);
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      void applySession(next);
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await authSignOut();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signOut,
    }),
    [session, loading, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
