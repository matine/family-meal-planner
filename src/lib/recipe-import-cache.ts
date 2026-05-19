import type { Json } from "@/integrations/supabase/types";
import { ingredientLineCacheKey, sha256Hex } from "@/lib/ingredient-normalize";

/** Serializable recipe shape stored in import cache (matches ParsedRecipe). */
export type CachedParsedRecipe = {
  title: string;
  ingredients: { name: string; amount?: string; preparation?: string }[];
  method: string;
  serves?: string;
  source_url?: string;
  image_url?: string;
};

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function normalizeImportUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch {
    return url.trim();
  }
}

export async function urlImportCacheKey(url: string): Promise<string> {
  return sha256Hex(normalizeImportUrl(url));
}

function cacheExpiryIso(): string {
  return new Date(Date.now() + CACHE_TTL_MS).toISOString();
}

async function adminOrNull() {
  if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
    return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function getCachedRecipeImport(urlHash: string): Promise<CachedParsedRecipe | null> {
  const admin = await adminOrNull();
  if (!admin) return null;
  const { data, error } = await admin
    .from("recipe_import_cache")
    .select("payload, expires_at")
    .eq("url_hash", urlHash)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data.payload as CachedParsedRecipe;
}

export async function setCachedRecipeImport(
  urlHash: string,
  payload: CachedParsedRecipe,
  extractionSource: string,
): Promise<void> {
  const admin = await adminOrNull();
  if (!admin) return;
  await admin.from("recipe_import_cache").upsert(
    {
      url_hash: urlHash,
      payload: payload as unknown as Json,
      extraction_source: extractionSource,
      expires_at: cacheExpiryIso(),
    },
    { onConflict: "url_hash" },
  );
}

export async function getCachedIngredientLine(
  rawLine: string,
): Promise<{ name: string; amount?: string; preparation?: string } | null> {
  const admin = await adminOrNull();
  if (!admin) return null;
  const key = await ingredientLineCacheKey(rawLine);
  const { data, error } = await admin
    .from("ingredient_line_cache")
    .select("name, amount, preparation, expires_at")
    .eq("line_key", key)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;
  return {
    name: data.name,
    amount: data.amount ?? undefined,
    preparation: data.preparation ?? undefined,
  };
}

export async function setCachedIngredientLine(
  rawLine: string,
  parts: { name: string; amount?: string; preparation?: string },
): Promise<void> {
  const admin = await adminOrNull();
  if (!admin) return;
  const line_key = await ingredientLineCacheKey(rawLine);
  await admin.from("ingredient_line_cache").upsert(
    {
      line_key,
      name: parts.name,
      amount: parts.amount ?? null,
      preparation: parts.preparation ?? null,
      expires_at: cacheExpiryIso(),
    },
    { onConflict: "line_key" },
  );
}
