import Dexie, { type Table } from "dexie";
import type { CanonicalLite } from "@/lib/canonical";
import type {
  Ingredient,
  MealPlanRow,
  Recipe,
  ShoppingItem,
} from "@/hooks/useTable";

export type CachedTableName =
  | "shopping_list"
  | "ingredients"
  | "recipes"
  | "meal_plan"
  | "canonical_ingredients";

export type OutboxEntry = {
  id: string;
  type: "shopping_checked";
  rowId: string;
  checked: boolean;
  createdAt: number;
};

type MetaRow = { key: string; syncedAt: string };

class OfflineDatabase extends Dexie {
  shopping_list!: Table<ShoppingItem, string>;
  ingredients!: Table<Ingredient, string>;
  recipes!: Table<Recipe, string>;
  meal_plan!: Table<MealPlanRow, string>;
  canonical_ingredients!: Table<CanonicalLite, string>;
  outbox!: Table<OutboxEntry, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("family-kitchen-offline");
    this.version(1).stores({
      shopping_list: "id",
      ingredients: "id",
      recipes: "id",
      meal_plan: "id",
      canonical_ingredients: "id",
      outbox: "id, rowId, createdAt",
      meta: "key",
    });
  }
}

let dbInstance: OfflineDatabase | undefined;

export function getOfflineDb(): OfflineDatabase {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available");
  }
  if (!dbInstance) dbInstance = new OfflineDatabase();
  return dbInstance;
}

function tableRef(name: CachedTableName) {
  const db = getOfflineDb();
  switch (name) {
    case "shopping_list":
      return db.shopping_list;
    case "ingredients":
      return db.ingredients;
    case "recipes":
      return db.recipes;
    case "meal_plan":
      return db.meal_plan;
    case "canonical_ingredients":
      return db.canonical_ingredients;
  }
}

export async function replaceTableCache<T extends { id: string }>(
  name: CachedTableName,
  rows: T[],
): Promise<void> {
  const t = tableRef(name);
  await getOfflineDb().transaction("rw", t, async () => {
    await t.clear();
    if (rows.length) await t.bulkPut(rows as never[]);
  });
}

export async function readTableCache<T extends { id: string; created_at?: string }>(
  name: CachedTableName,
): Promise<T[]> {
  const rows = (await tableRef(name).toArray()) as T[];
  if (name === "canonical_ingredients") {
    return rows.sort((a, b) =>
      String((a as { name?: string }).name ?? "").localeCompare(
        String((b as { name?: string }).name ?? ""),
      ),
    );
  }
  return rows.sort((a, b) => {
    const aTs = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTs = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTs - aTs;
  });
}

export async function getCachedRecipe(id: string): Promise<Recipe | undefined> {
  return getOfflineDb().recipes.get(id);
}

export async function patchShoppingItemChecked(
  id: string,
  checked: boolean,
): Promise<void> {
  await getOfflineDb().shopping_list.update(id, { checked });
}

export async function addOutboxShoppingChecked(
  rowId: string,
  checked: boolean,
): Promise<void> {
  const db = getOfflineDb();
  const existing = await db.outbox.where("rowId").equals(rowId).toArray();
  const stale = existing.filter((e) => e.type === "shopping_checked");
  if (stale.length) await db.outbox.bulkDelete(stale.map((e) => e.id));
  await db.outbox.put({
    id: crypto.randomUUID(),
    type: "shopping_checked",
    rowId,
    checked,
    createdAt: Date.now(),
  });
}

export async function listOutbox(): Promise<OutboxEntry[]> {
  return getOfflineDb()
    .outbox.orderBy("createdAt")
    .toArray();
}

export async function removeOutboxIds(ids: string[]): Promise<void> {
  if (ids.length) await getOfflineDb().outbox.bulkDelete(ids);
}

export async function clearOutboxForShoppingRow(rowId: string): Promise<void> {
  const entries = await getOfflineDb().outbox.where("rowId").equals(rowId).toArray();
  const ids = entries.filter((e) => e.type === "shopping_checked").map((e) => e.id);
  await removeOutboxIds(ids);
}

export async function setLastSyncedAt(iso: string): Promise<void> {
  await getOfflineDb().meta.put({ key: "lastSyncedAt", syncedAt: iso });
}

export async function getLastSyncedAt(): Promise<string | null> {
  const row = await getOfflineDb().meta.get("lastSyncedAt");
  return row?.syncedAt ?? null;
}

export const OFFLINE_DATA_CHANGED = "family-kitchen:offline-data-changed";

export type OfflineDataChangedDetail = { table?: CachedTableName };

export function notifyOfflineDataChanged(table?: CachedTableName): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<OfflineDataChangedDetail>(OFFLINE_DATA_CHANGED, {
        detail: table ? { table } : {},
      }),
    );
  }
}
