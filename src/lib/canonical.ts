import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { normalize } from "./ingredient-match";

export type Canonical = Tables<"canonical_ingredients">;
export type CanonicalLite = {
  id: string;
  name: string;
  /** Last pantry category used for this ingredient (if any). */
  last_category?: string | null;
};

/** Aliases map: normalized raw -> canonical_ingredients.id */
export type AliasMap = Record<string, string>;

/** Options for {@link resolveOrCreateCanonical}. */
export type ResolveCanonicalOptions = {
  /**
   * When true, skip learned `ingredient_aliases` lookups so the typed name can become
   * its own canonical even if an alias previously mapped that text elsewhere.
   */
  skipAliases?: boolean;
};

/** Find an existing canonical by normalized name, alias hit, or create one. */
export async function resolveOrCreateCanonical(
  rawName: string,
  canonicals: CanonicalLite[],
  aliases: AliasMap = {},
  options?: ResolveCanonicalOptions,
): Promise<CanonicalLite | null> {
  const norm = normalize(rawName);
  if (!norm) return null;

  // 1. Exact (canonical names are stored lowercased; normalize for safety)
  const exact = canonicals.find((c) => c.name.toLowerCase() === norm || normalize(c.name) === norm);
  if (exact) return exact;

  // 2. Alias hit (optional — explicit “new ingredient” flows should skip)
  if (!options?.skipAliases) {
    const aliasId = aliases[norm];
    if (aliasId) {
      const c = canonicals.find((x) => x.id === aliasId);
      if (c) return c;
    }
  }

  // 3. Create — preserve user's raw text (only trim trailing whitespace, lowercase for storage).
  const lower = rawName.replace(/\s+$/, "").toLowerCase();
  if (!lower) return null;
  // Re-check exact in case the cleaned form already exists (avoid dupes like "peas" vs normalize→"pea").
  const existsExact = canonicals.find((c) => c.name.toLowerCase() === lower);
  if (existsExact) return existsExact;
  const { data, error } = await supabase
    .from("canonical_ingredients")
    .insert({ name: lower })
    .select("id, name")
    .single();
  if (error) {
    // Race: someone else inserted with same unique name. Re-fetch.
    const { data: hit } = await supabase
      .from("canonical_ingredients")
      .select("id, name")
      .eq("name", lower)
      .maybeSingle();
    if (hit) return hit;
    throw new Error(error.message);
  }
  return data;
}

/** Suggest canonicals that start-with or include the typed query. */
export function suggestCanonicals(query: string, canonicals: CanonicalLite[], limit = 6): CanonicalLite[] {
  const q = normalize(query);
  if (!q) return [];
  const starts: CanonicalLite[] = [];
  const contains: CanonicalLite[] = [];
  for (const c of canonicals) {
    const n = normalize(c.name);
    if (n.startsWith(q)) starts.push(c);
    else if (n.includes(q)) contains.push(c);
  }
  return [...starts, ...contains].slice(0, limit);
}
