import type { LucideIcon } from "lucide-react";
import { Candy, Coffee, Cookie, Moon, Sun } from "lucide-react";

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "sweet"] as const;

export type RecipeMealType = (typeof MEAL_TYPES)[number];

const MEAL_TYPE_SET = new Set<string>(MEAL_TYPES);

export const MEAL_TYPE_LABELS: Record<RecipeMealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  sweet: "Sweet",
};

export const MEAL_TYPE_ICONS: Record<RecipeMealType, LucideIcon> = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Cookie,
  sweet: Candy,
};

export function isRecipeMealType(value: string): value is RecipeMealType {
  return MEAL_TYPE_SET.has(value);
}

export function parseMealTypes(value: unknown): RecipeMealType[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<RecipeMealType>();
  const out: RecipeMealType[] = [];
  for (const meal of MEAL_TYPES) {
    if (value.includes(meal) && !seen.has(meal)) {
      seen.add(meal);
      out.push(meal);
    }
  }
  return out;
}

export function mealTypesSummary(selected: RecipeMealType[]): string {
  if (selected.length === 0) return "Meals";
  if (selected.length <= 2) {
    return selected.map((m) => MEAL_TYPE_LABELS[m]).join(", ");
  }
  return `${selected.length} meals`;
}

export function recipeMatchesMealTypeFilter(
  recipeMealTypes: RecipeMealType[],
  selected: RecipeMealType[],
): boolean {
  if (selected.length === 0) return true;
  return selected.some((meal) => recipeMealTypes.includes(meal));
}

export function toggleMealType(
  selected: RecipeMealType[],
  meal: RecipeMealType,
): RecipeMealType[] {
  return selected.includes(meal)
    ? selected.filter((m) => m !== meal)
    : [...selected, meal];
}
