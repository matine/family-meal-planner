import type { Recipe } from "@/hooks/useTable";
import { normalize } from "@/lib/ingredient-match";

export function recipeMatchesSearch(recipe: Recipe, query: string): boolean {
  const q = normalize(query.trim());
  if (!q) return true;
  return normalize(recipe.title ?? "").includes(q);
}
