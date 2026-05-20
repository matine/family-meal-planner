import { Carrot, Clock } from "lucide-react";
import {
  formatCookTime,
  type RecipePantryStatus,
} from "@/lib/recipe-tags";

export type RecipeCardMetaItem = {
  key: string;
  icon: typeof Clock | typeof Carrot;
  label: string;
  tone?: "default" | "success";
};

export function buildRecipeCardMetaItems({
  cookTimeMinutes,
  pantryStatus,
}: {
  cookTimeMinutes: number | null;
  pantryStatus: RecipePantryStatus;
}): RecipeCardMetaItem[] {
  const items: RecipeCardMetaItem[] = [];

  const cookTime = formatCookTime(cookTimeMinutes);
  if (cookTime) {
    items.push({ key: "cook-time", icon: Clock, label: cookTime });
  }

  if (pantryStatus.totalRequired > 0) {
    items.push({
      key: "pantry",
      icon: Carrot,
      label: `${pantryStatus.haveRequired}/${pantryStatus.totalRequired} in pantry`,
      tone: pantryStatus.haveAll ? "success" : "default",
    });
  }

  return items;
}
