import type { MealPlanRow, Recipe, RecipeIngredient } from "@/hooks/useTable";
import { normalize } from "@/lib/ingredient-match";
import { ingredientCanonicalIds } from "@/lib/recipe-ingredient";
import { stripRecipeMetaIngredient } from "@/lib/recipe-serves-fallback";

export type PlannerRecipeRef = {
  id: string;
  title: string;
};

/**
 * Maps canonical ingredient ids (and normalized name keys) to recipes currently in the meal planner.
 */
export function buildPlannerIngredientIndex(
  planRows: MealPlanRow[],
  recipesById: Map<string, Recipe>,
): Map<string, PlannerRecipeRef[]> {
  const index = new Map<string, Map<string, PlannerRecipeRef>>();

  for (const plan of planRows) {
    const recipeId = plan.recipe_id;
    if (!recipeId) continue;
    const recipe = recipesById.get(recipeId);
    if (!recipe) continue;

    const ingredients = stripRecipeMetaIngredient(
      (recipe.ingredients as RecipeIngredient[] | null) ?? [],
    );

    for (const ing of ingredients) {
      const canonicalIds = ingredientCanonicalIds(ing);
      if (canonicalIds.length) {
        for (const cid of canonicalIds) {
          let bucket = index.get(cid);
          if (!bucket) {
            bucket = new Map();
            index.set(cid, bucket);
          }
          bucket.set(recipe.id, { id: recipe.id, title: recipe.title });
        }
      } else {
        const norm = normalize(ing.name);
        if (!norm) continue;
        const key = `name:${norm}`;
        let bucket = index.get(key);
        if (!bucket) {
          bucket = new Map();
          index.set(key, bucket);
        }
        bucket.set(recipe.id, { id: recipe.id, title: recipe.title });
      }
    }
  }

  const out = new Map<string, PlannerRecipeRef[]>();
  for (const [key, bucket] of index) {
    out.set(key, [...bucket.values()]);
  }
  return out;
}

export function plannerRecipesForShoppingItem(
  index: Map<string, PlannerRecipeRef[]>,
  item: { canonical_id: string | null; name: string },
): PlannerRecipeRef[] {
  if (item.canonical_id) {
    return index.get(item.canonical_id) ?? [];
  }
  const norm = normalize(item.name);
  if (!norm) return [];
  return index.get(`name:${norm}`) ?? [];
}
