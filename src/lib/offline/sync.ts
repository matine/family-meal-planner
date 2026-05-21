import { supabase } from "@/integrations/supabase/client";
import type { CanonicalLite } from "@/lib/canonical";
import {
  listOutbox,
  notifyOfflineDataChanged,
  removeOutboxIds,
  replaceTableCache,
  setLastSyncedAt,
  type CachedTableName,
} from "@/lib/offline/db";
import { isOnline } from "@/lib/offline/online";

export async function pullAllCaches(): Promise<void> {
  const [shopping, ingredients, recipes, mealPlan, canonicals] = await Promise.all([
    supabase.from("shopping_list").select("*").order("created_at", { ascending: false }),
    supabase.from("ingredients").select("*").order("created_at", { ascending: false }),
    supabase.from("recipes").select("*").order("created_at", { ascending: false }),
    supabase.from("meal_plan").select("*").order("created_at", { ascending: false }),
    supabase
      .from("canonical_ingredients")
      .select("id, name, last_category")
      .order("name", { ascending: true }),
  ]);

  const errors = [
    shopping.error,
    ingredients.error,
    recipes.error,
    mealPlan.error,
    canonicals.error,
  ].filter(Boolean);
  if (errors.length) {
    throw new Error(errors[0]!.message);
  }

  await Promise.all([
    replaceTableCache("shopping_list", shopping.data ?? []),
    replaceTableCache("ingredients", ingredients.data ?? []),
    replaceTableCache("recipes", recipes.data ?? []),
    replaceTableCache("meal_plan", mealPlan.data ?? []),
    replaceTableCache("canonical_ingredients", (canonicals.data ?? []) as CanonicalLite[]),
  ]);

  await setLastSyncedAt(new Date().toISOString());
  notifyOfflineDataChanged();
}

export async function flushShoppingOutbox(): Promise<void> {
  const entries = await listOutbox();
  const shoppingEntries = entries.filter((e) => e.type === "shopping_checked");
  if (!shoppingEntries.length) return;

  const latestByRow = new Map<string, (typeof shoppingEntries)[0]>();
  for (const entry of shoppingEntries) {
    const prev = latestByRow.get(entry.rowId);
    if (!prev || entry.createdAt >= prev.createdAt) latestByRow.set(entry.rowId, entry);
  }

  const appliedIds: string[] = [];
  for (const entry of latestByRow.values()) {
    const { error } = await supabase
      .from("shopping_list")
      .update({ checked: entry.checked })
      .eq("id", entry.rowId);
    if (error) throw new Error(error.message);
    appliedIds.push(
      ...shoppingEntries.filter((e) => e.rowId === entry.rowId).map((e) => e.id),
    );
  }

  await removeOutboxIds([...new Set(appliedIds)]);
}

/** Push pending changes, then refresh local caches from Supabase. */
export async function syncOfflineData(): Promise<void> {
  if (!isOnline()) return;
  await flushShoppingOutbox();
  await pullAllCaches();
}

export async function syncTableFromRemote(table: CachedTableName): Promise<void> {
  if (!isOnline()) return;
  if (table === "canonical_ingredients") {
    const { data, error } = await supabase
      .from("canonical_ingredients")
      .select("id, name, last_category")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    await replaceTableCache(table, (data ?? []) as CanonicalLite[]);
  } else {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    await replaceTableCache(table, data ?? []);
  }
  notifyOfflineDataChanged();
}
