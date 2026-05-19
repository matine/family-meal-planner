import { normalize } from "@/lib/ingredient-match";

export type PantryRowLite = {
  canonical_id?: string | null;
  name: string;
};

/** Whether this ingredient is already represented in the pantry (by canonical id or name). */
export function isInPantry(
  pantryRows: PantryRowLite[],
  item: { canonicalId?: string | null; name: string },
): boolean {
  if (item.canonicalId && pantryRows.some((p) => p.canonical_id === item.canonicalId)) {
    return true;
  }
  const norm = normalize(item.name);
  if (!norm) return false;
  return pantryRows.some((p) => normalize(p.name) === norm);
}
