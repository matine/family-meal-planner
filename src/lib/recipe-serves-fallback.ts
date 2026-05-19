import type { PostgrestError } from "@supabase/supabase-js";
import type { RecipeIngredient } from "@/hooks/useTable";

/** PostgREST when `recipes.serves` is missing from DB or not yet in the API schema cache. */
export function isRecipesServesColumnError(error: PostgrestError | null | undefined): boolean {
  return (
    error?.code === "PGRST204" &&
    typeof error.message === "string" &&
    error.message.includes("'serves' column")
  );
}

/** Hidden ingredient row until `recipes.serves` exists in PostgREST schema. */
export const RECIPE_META_INGREDIENT_NAME = "__recipe_meta__";

export function getRecipeServes(recipe: {
  serves?: string | null;
  ingredients?: unknown;
}): string | null {
  const fromColumn = recipe.serves?.trim();
  if (fromColumn) return fromColumn;
  const ings = Array.isArray(recipe.ingredients)
    ? (recipe.ingredients as RecipeIngredient[])
    : [];
  const meta = ings.find((i) => i.name === RECIPE_META_INGREDIENT_NAME);
  return meta?.originalLine?.trim() || null;
}

export function stripRecipeMetaIngredient<T extends { name: string }>(ingredients: T[]): T[] {
  return ingredients.filter((i) => i.name !== RECIPE_META_INGREDIENT_NAME);
}

export function withServesMetaIngredient(
  ingredients: RecipeIngredient[],
  serves: string | null | undefined,
): RecipeIngredient[] {
  const base = stripRecipeMetaIngredient(ingredients);
  const s = serves?.trim();
  if (!s) return base;
  return [{ name: RECIPE_META_INGREDIENT_NAME, originalLine: s }, ...base];
}

/** True when source text explicitly mentions this serving count (avoids invented "Serves 4"). */
export function servesMentionedInSource(serves: string, sourceText: string): boolean {
  const count = serves.trim();
  if (!count) return false;
  const escaped = count.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `(?:serves?|servings?|yields?|makes?|feeds?)\\s*[:\\-–—]?\\s*${escaped}\\b|\\b${escaped}\\s+(?:servings?|portions?)\\b`,
    "i",
  );
  return re.test(sourceText);
}

/** Drop serves when the import source text does not mention a serving count. */
export function sanitizeImportedServes(
  serves: string | undefined,
  sourceText?: string,
): string | undefined {
  const s = serves?.trim();
  if (!s) return undefined;
  const haystack = sourceText?.trim();
  if (!haystack) return s;
  return servesMentionedInSource(s, haystack) ? s : undefined;
}
