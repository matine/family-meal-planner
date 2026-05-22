/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** Comma-separated Gmail addresses allowed to sign in (optional). */
  readonly VITE_ALLOWED_EMAILS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
