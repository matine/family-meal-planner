import type { ShoppingItem } from "@/hooks/useTable";
import {
  addOutboxShoppingChecked,
  clearOutboxForShoppingRow,
  notifyOfflineDataChanged,
  patchShoppingItemChecked,
} from "@/lib/offline/db";
import { isOnline } from "@/lib/offline/online";
import { supabase } from "@/integrations/supabase/client";

/** Optimistic checkbox toggle — works offline; syncs when back online. */
export async function toggleShoppingItemChecked(
  item: ShoppingItem,
  nextChecked: boolean,
  onOptimisticRows: (updater: (rows: ShoppingItem[]) => ShoppingItem[]) => void,
): Promise<void> {
  if (nextChecked === item.checked) return;

  onOptimisticRows((rows) =>
    rows.map((r) => (r.id === item.id ? { ...r, checked: nextChecked } : r)),
  );

  if (isOnline()) {
    const { error } = await supabase
      .from("shopping_list")
      .update({ checked: nextChecked })
      .eq("id", item.id);
    if (error) {
      onOptimisticRows((rows) =>
        rows.map((r) => (r.id === item.id ? { ...r, checked: item.checked } : r)),
      );
      throw new Error(error.message);
    }
    // Keep IndexedDB in sync for offline later, without triggering a global refetch.
    await patchShoppingItemChecked(item.id, nextChecked);
    await clearOutboxForShoppingRow(item.id);
    return;
  }

  await patchShoppingItemChecked(item.id, nextChecked);
  await addOutboxShoppingChecked(item.id, nextChecked);
  notifyOfflineDataChanged("shopping_list");
}
