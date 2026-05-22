import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isPublicAuthPath, safeRedirectPath } from "@/lib/auth";

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isPublic = isPublicAuthPath(pathname);

  useEffect(() => {
    if (loading) return;
    if (!session && !isPublic) {
      void navigate({
        href: `/login?redirect=${encodeURIComponent(pathname)}`,
      });
      return;
    }
    if (session && pathname === "/login") {
      void navigate({ href: safeRedirectPath("/") });
    }
  }, [loading, session, isPublic, pathname, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
      </div>
    );
  }

  if (!session && !isPublic) return null;

  return <>{children}</>;
}
