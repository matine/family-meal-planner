import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  OFFLINE_DATA_CHANGED,
  readTableCache,
  replaceTableCache,
  type CachedTableName,
  type OfflineDataChangedDetail,
} from "@/lib/offline/db";
import { isOnline } from "@/lib/offline/online";

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

const REALTIME_DEBOUNCE_MS = 300;

export function useTable<T extends { id: string; created_at: string }>(
  table: "ingredients" | "recipes" | "meal_plan" | "shopping_list",
) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2, 8));
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadFromCache = useCallback(async () => {
    const cached = await readTableCache<T>(table);
    setRows(cached);
    setLoading(false);
  }, [table]);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }

    if (!isOnline()) {
      await loadFromCache();
      return;
    }

    try {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const next = (data ?? []) as unknown as T[];
      await replaceTableCache(table, next);
      setRows(next);
    } catch {
      await loadFromCache();
    } finally {
      setLoading(false);
    }
  }, [table, loadFromCache]);

  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
    realtimeTimerRef.current = setTimeout(() => {
      realtimeTimerRef.current = null;
      void refresh();
    }, REALTIME_DEBOUNCE_MS);
  }, [refresh]);

  useEffect(() => {
    void refresh();

    const onOfflineChange = (event: Event) => {
      const detail = (event as CustomEvent<OfflineDataChangedDetail>).detail;
      const target = detail?.table as CachedTableName | undefined;
      if (target && target !== table) return;
      void refresh();
    };
    window.addEventListener(OFFLINE_DATA_CHANGED, onOfflineChange);
    window.addEventListener("online", onOfflineChange);
    window.addEventListener("offline", onOfflineChange);

    let channel: ReturnType<typeof supabase.channel> | undefined;
    if (isOnline()) {
      channel = supabase
        .channel(`rt-${table}-${instanceIdRef.current}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, scheduleRealtimeRefresh)
        .subscribe();
    }

    return () => {
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current);
      window.removeEventListener(OFFLINE_DATA_CHANGED, onOfflineChange);
      window.removeEventListener("online", onOfflineChange);
      window.removeEventListener("offline", onOfflineChange);
      if (channel) supabase.removeChannel(channel);
    };
  }, [table, refresh, scheduleRealtimeRefresh]);

  return { rows, loading, refresh, setRows };
}
