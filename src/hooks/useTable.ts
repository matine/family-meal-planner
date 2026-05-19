import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Ingredient = Tables<"ingredients">;
export type Recipe = Tables<"recipes">;
export type MealPlanRow = Tables<"meal_plan">;
export type ShoppingItem = Tables<"shopping_list">;
export type CanonicalIngredient = Tables<"canonical_ingredients">;

export type RecipeIngredient = {
  name: string;
  amount?: string;
  preparation?: string;
  /** As read from the recipe before UK unit/name conversion (AI import). */
  sourceLine?: string;
  /** Verbatim line from the source when available (import / paste). */
  originalLine?: string;
  /** Garnish, sides, or other non-essential lines — shown separately on the recipe page. */
  optional?: boolean;
  canonicalId?: string;
  /** Extra pantry/library items this recipe line also stands for (e.g. substitutes). */
  canonicalIds?: string[];
};

export function useTable<T extends { id: string; created_at: string }>(
  table: "ingredients" | "recipes" | "meal_plan" | "shopping_list"
) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  // Unique per-mount suffix so concurrent useTable() callers for the same
  // table don't share a Supabase realtime channel topic (which would make the
  // second .on() throw "cannot add postgres_changes callbacks after subscribe()").
  const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2, 8));

  const refresh = useCallback(async () => {
    const { data } = await supabase.from(table).select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as unknown as T[]);
    setLoading(false);
  }, [table]);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`rt-${table}-${instanceIdRef.current}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, refresh]);

  return { rows, loading, refresh };
}
