import { supabase } from "@/integrations/supabase/client";
import type { RecipeIngredient } from "@/hooks/useTable";
import type { RecipeMealType } from "@/lib/recipe-meal-types";
import {
  isRecipesServesColumnError,
  stripRecipeMetaIngredient,
  withServesMetaIngredient,
} from "@/lib/recipe-serves-fallback";
import { normalizeRecipeImageUrl } from "@/lib/recipe-image";
import { parseCookTimeMinutes, type RecipeTag } from "@/lib/recipe-tags";

export type SaveRecipeInput = {
  title: string;
  ingredients: RecipeIngredient[];
  method: string;
  serves?: string;
  source_url?: string;
  image_url?: string;
  tags?: RecipeTag[];
  cook_time_minutes?: number | null;
  meal_types?: RecipeMealType[];
};

export async function saveRecipe(r: SaveRecipeInput): Promise<string> {
  const serves = r.serves?.trim() || null;
  const ingredients = stripRecipeMetaIngredient(r.ingredients);
  const tags = r.tags ?? [];
  const meal_types = r.meal_types ?? [];
  const cook_time_minutes = parseCookTimeMinutes(r.cook_time_minutes);
  const image_url = normalizeRecipeImageUrl(r.image_url ?? "");
  const insertPayload = {
    title: r.title,
    ingredients: ingredients as any,
    method: r.method,
    serves,
    source_url: r.source_url ?? null,
    image_url,
    tags,
    meal_types,
    cook_time_minutes,
  };
  const { data, error } = await supabase
    .from("recipes")
    .insert(insertPayload)
    .select("id")
    .single();

  if (isRecipesServesColumnError(error)) {
    if (import.meta.env.DEV) {
      console.warn(
        "[recipes] `recipes.serves` not in PostgREST schema; storing serves in ingredients until migration is applied.",
      );
    }
    const { data: retryData, error: retryError } = await supabase
      .from("recipes")
      .insert({
        title: r.title,
        ingredients: withServesMetaIngredient(ingredients, serves) as any,
        method: r.method,
        source_url: r.source_url ?? null,
        image_url,
        tags,
        meal_types,
        cook_time_minutes,
      })
      .select("id")
      .single();
    if (retryError) throw new Error(retryError.message);
    if (!retryData?.id) throw new Error("Recipe saved but id was missing");
    return retryData.id;
  }

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Recipe saved but id was missing");
  return data.id;
}
