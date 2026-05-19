import type { Recipe, RecipeIngredient } from "@/hooks/useTable";
import { ingredientCanonicalIds, isOptionalIngredient } from "@/lib/recipe-ingredient";
import { stripRecipeMetaIngredient } from "@/lib/recipe-serves-fallback";

export const RECIPE_TAGS = ["Quick", "Healthy", "Family", "Marlo", "Keto"] as const;

export type RecipeTag = (typeof RECIPE_TAGS)[number];

const TAG_SET = new Set<string>(RECIPE_TAGS);

export function isRecipeTag(value: string): value is RecipeTag {
  return TAG_SET.has(value);
}

/** Normalize DB / JSON tags to known labels in display order. */
export function parseRecipeTags(tags: unknown): RecipeTag[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<RecipeTag>();
  const out: RecipeTag[] = [];
  for (const tag of RECIPE_TAGS) {
    if (tags.includes(tag) && !seen.has(tag)) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
}

export function recipeMatchesTagFilter(recipeTags: RecipeTag[], selectedTags: RecipeTag[]): boolean {
  if (selectedTags.length === 0) return true;
  return selectedTags.some((tag) => recipeTags.includes(tag));
}

export type RecipePantryStatus = {
  totalRequired: number;
  haveRequired: number;
  haveAll: boolean;
};

export function getRecipePantryStatus(
  recipe: Pick<Recipe, "ingredients">,
  pantryCanonicalIds: Set<string>,
): RecipePantryStatus {
  const recipeIngs = stripRecipeMetaIngredient(
    (recipe.ingredients as RecipeIngredient[] | null) ?? [],
  );
  const requiredIngs = recipeIngs.filter((i) => !isOptionalIngredient(i));
  const totalRequired = requiredIngs.length;
  const haveRequired = requiredIngs.filter((i) =>
    ingredientCanonicalIds(i).some((id) => pantryCanonicalIds.has(id)),
  ).length;
  return {
    totalRequired,
    haveRequired,
    haveAll: totalRequired > 0 && haveRequired === totalRequired,
  };
}

/** Toggle value for the combined recipe list filter bar (not stored on recipes). */
export const IN_PANTRY_FILTER = "in-pantry";

export function recipeMatchesInPantryFilter(
  status: RecipePantryStatus,
  inPantryOnly: boolean,
): boolean {
  if (!inPantryOnly) return true;
  return status.haveAll;
}
