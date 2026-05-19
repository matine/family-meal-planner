import type { RecipeIngredient } from "@/hooks/useTable";
import { ingredientLineFromParts, ingredientLinesEquivalent } from "@/lib/ingredient-normalize";

/** All canonical ids referenced by a recipe ingredient (multi-match + legacy single). */
export function ingredientCanonicalIds(ing: RecipeIngredient): string[] {
  const fromArr = ing.canonicalIds?.filter(Boolean) ?? [];
  if (fromArr.length) return [...new Set(fromArr)];
  if (ing.canonicalId) return [ing.canonicalId];
  return [];
}

/**
 * Human-readable line from structured fields, or persisted `originalLine` when present.
 */
export function formatOriginalIngredientLine(ing: {
  name: string;
  amount?: string;
  preparation?: string;
  originalLine?: string;
}): string {
  if (ing.originalLine?.trim()) return ing.originalLine.trim();
  return ingredientLineFromParts(ing);
}

/** True when a cup/oz conversion preview should show (source differs from converted line). */
export function ingredientShowsUnitConversion(ing: {
  name: string;
  amount?: string;
  preparation?: string;
  sourceLine?: string;
}): boolean {
  const source = ing.sourceLine?.trim();
  if (!source) return false;
  const converted = formatConvertedIngredientDisplay(ing).trim();
  if (!converted) return false;
  return !ingredientLinesEquivalent(source, converted);
}

/** Drop sourceLine when it matches the converted line (no real conversion). */
export function stripRedundantSourceLine<T extends RecipeIngredient>(ing: T): T {
  if (!ing.sourceLine?.trim()) return ing;
  if (ingredientShowsUnitConversion(ing)) return ing;
  const { sourceLine: _removed, ...rest } = ing;
  return rest as T;
}

/** Display line from structured fields (ignores originalLine / sourceLine). */
export function formatConvertedIngredientDisplay(ing: {
  name: string;
  amount?: string;
  preparation?: string;
}): string {
  return ingredientLineFromParts(ing);
}

/** Text used for fuzzy / alias matching (prefers full line when present). */
export function ingredientMatchRaw(ing: {
  name: string;
  amount?: string;
  preparation?: string;
  originalLine?: string;
}): string {
  return formatOriginalIngredientLine(ing).trim() || ing.name.trim();
}

export function isOptionalIngredient(ing: RecipeIngredient): boolean {
  return ing.optional === true;
}

/** Normalize a recipe ingredient for JSON storage (drops empty optional fields). */
export function serializeRecipeIngredient(ing: RecipeIngredient): RecipeIngredient | null {
  const name = ing.name.trim();
  if (!name) return null;
  const cleaned = stripRedundantSourceLine(ing);
  return {
    name,
    amount: cleaned.amount?.trim() || undefined,
    preparation: cleaned.preparation?.trim() || undefined,
    sourceLine: cleaned.sourceLine?.trim() || undefined,
    originalLine: cleaned.originalLine?.trim() || undefined,
    canonicalId: ing.canonicalId,
    canonicalIds: ing.canonicalIds?.length ? ing.canonicalIds : undefined,
    ...(ing.optional === true ? { optional: true } : {}),
  };
}

/** Required lines first, optional lines last (order preserved within each group). */
export function partitionRecipeIngredients(ingredients: RecipeIngredient[]): {
  required: RecipeIngredient[];
  optional: RecipeIngredient[];
} {
  const required: RecipeIngredient[] = [];
  const optional: RecipeIngredient[] = [];
  for (const ing of ingredients) {
    if (isOptionalIngredient(ing)) optional.push(ing);
    else required.push(ing);
  }
  return { required, optional };
}

/** Persist shape: first id in `canonicalId`, rest in `canonicalIds` when needed. */
export function packCanonicalRefs(
  ids: string[],
): Pick<RecipeIngredient, "canonicalId" | "canonicalIds"> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return {};
  if (uniq.length === 1) return { canonicalId: uniq[0] };
  return { canonicalId: uniq[0], canonicalIds: uniq };
}
