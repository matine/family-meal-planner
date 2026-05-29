import { supabase } from "@/integrations/supabase/client";

export const PUBLIC_AUTH_PATHS = ["/login", "/auth/callback"] as const;

export function isPublicAuthPath(pathname: string): boolean {
  return (PUBLIC_AUTH_PATHS as readonly string[]).includes(pathname);
}

/** Optional comma-separated allowlist in VITE_ALLOWED_EMAILS (e.g. you@gmail.com,partner@gmail.com). */
export function isEmailAllowed(email: string | null | undefined): boolean {
  const raw = import.meta.env.VITE_ALLOWED_EMAILS?.trim();
  if (!raw) return true;
  if (!email) return false;
  const allowed = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export function safeRedirectPath(path: string | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/";
  if (isPublicAuthPath(path) || path.startsWith("/auth/")) return "/";
  return path;
}

/**
 * App origin for OAuth callbacks.
 * In the browser, always use the current origin so localhost works even when
 * VITE_APP_URL is set to production (e.g. via Vercel env pull).
 */
export function getAppOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  const configured = import.meta.env.VITE_APP_URL?.trim().replace(/\/$/, "");
  return configured ?? "";
}

export async function signInWithGoogle(nextPath = "/"): Promise<{ error: Error | null }> {
  const origin = getAppOrigin();
  if (!origin) {
    return { error: new Error("App URL is not configured") };
  }
  const redirectTo = `${origin}/auth/callback?redirect=${encodeURIComponent(safeRedirectPath(nextPath))}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  return { error: error ? new Error(error.message) : null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
