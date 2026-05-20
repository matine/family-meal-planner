import type { LucideIcon } from "lucide-react";
import { Clock, Flame, Heart, Sparkles, Users, User, Zap } from "lucide-react";
import type { Recipe, RecipeIngredient } from "@/hooks/useTable";
import { ingredientCanonicalIds, isOptionalIngredient } from "@/lib/recipe-ingredient";
import { stripRecipeMetaIngredient } from "@/lib/recipe-serves-fallback";

export const RECIPE_TAGS = [
  "Low effort",
  "Healthy",
  "Family",
  "Marlo",
  "Keto",
  "Special",
] as const;

export type RecipeTag = (typeof RECIPE_TAGS)[number];

const TAG_SET = new Set<string>(RECIPE_TAGS);

export const TAG_ICONS: Record<RecipeTag, LucideIcon> = {
  "Low effort": Zap,
  Healthy: Heart,
  Family: Users,
  Marlo: User,
  Keto: Flame,
  Special: Sparkles,
};

/** Max cook time buckets for list filters (minutes). */
export const COOK_TIME_FILTER_MAX_MINUTES = [15, 30, 45, 60] as const;

export type CookTimeFilterMax = (typeof COOK_TIME_FILTER_MAX_MINUTES)[number];

export function cookTimeFilterId(minutes: CookTimeFilterMax): string {
  return `cook-${minutes}`;
}

export function parseCookTimeFilterId(value: string): CookTimeFilterMax | null {
  const match = /^cook-(\d+)$/.exec(value);
  if (!match) return null;
  const minutes = Number(match[1]);
  return COOK_TIME_FILTER_MAX_MINUTES.includes(minutes as CookTimeFilterMax)
    ? (minutes as CookTimeFilterMax)
    : null;
}

export function isRecipeTag(value: string): value is RecipeTag {
  return TAG_SET.has(value);
}

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

export function parseCookTimeMinutes(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

export function formatCookTime(minutes: number | null | undefined): string | null {
  const m = parseCookTimeMinutes(minutes);
  if (m == null) return null;
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r > 0 ? `${h}h ${r}m` : `${h}h`;
}

export function formatCookTimeFilter(maxMinutes: CookTimeFilterMax): string {
  return `≤${maxMinutes}m`;
}

export function recipeMatchesTagFilter(recipeTags: RecipeTag[], selectedTags: RecipeTag[]): boolean {
  if (selectedTags.length === 0) return true;
  return selectedTags.some((tag) => recipeTags.includes(tag));
}

export function recipeMatchesCookTimeFilter(
  cookTimeMinutes: number | null | undefined,
  selectedMaxMinutes: CookTimeFilterMax[],
): boolean {
  if (selectedMaxMinutes.length === 0) return true;
  const minutes = parseCookTimeMinutes(cookTimeMinutes);
  if (minutes == null) return false;
  return selectedMaxMinutes.some((max) => minutes <= max);
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

export const IN_PANTRY_FILTER = "in-pantry";

export function recipeMatchesInPantryFilter(
  status: RecipePantryStatus,
  inPantryOnly: boolean,
): boolean {
  if (!inPantryOnly) return true;
  return status.haveAll;
}
