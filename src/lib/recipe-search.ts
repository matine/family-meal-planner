import type { Recipe, RecipeIngredient } from "@/hooks/useTable";
import { normalize } from "@/lib/ingredient-match";
import { formatOriginalIngredientLine } from "@/lib/recipe-ingredient";
import { MEAL_TYPE_LABELS, parseMealTypes } from "@/lib/recipe-meal-types";
import { getRecipeServes, stripRecipeMetaIngredient } from "@/lib/recipe-serves-fallback";
import { parseRecipeTags } from "@/lib/recipe-tags";

/** Normalized text used to match recipe list search queries. */
export function recipeSearchBlob(recipe: Recipe): string {
  const parts: string[] = [recipe.title ?? ""];
  if (recipe.method) parts.push(recipe.method);
  if (recipe.source_url) parts.push(recipe.source_url);
  const serves = getRecipeServes(recipe);
  if (serves) parts.push(serves);
  for (const tag of parseRecipeTags(recipe.tags)) parts.push(tag);
  for (const meal of parseMealTypes(recipe.meal_types)) {
    parts.push(meal, MEAL_TYPE_LABELS[meal]);
  }
  const ingredients = stripRecipeMetaIngredient(
    (recipe.ingredients as RecipeIngredient[] | null) ?? [],
  );
  for (const ing of ingredients) {
    parts.push(formatOriginalIngredientLine(ing));
    if (ing.name) parts.push(ing.name);
    if (ing.amount) parts.push(ing.amount);
    if (ing.preparation) parts.push(ing.preparation);
  }
  return normalize(parts.join(" "));
}

export function recipeMatchesSearch(recipe: Recipe, query: string): boolean {
  const q = normalize(query.trim());
  if (!q) return true;
  return recipeSearchBlob(recipe).includes(q);
}
