import { Carrot, Clock, Users, UtensilsCrossed } from "lucide-react";
import { formatMealTypesLabel, type RecipeMealType } from "@/lib/recipe-meal-types";
import {
  TAG_ICONS,
  formatCookTime,
  type RecipePantryStatus,
  type RecipeTag,
} from "@/lib/recipe-tags";
import { cn } from "@/lib/utils";

export const recipeChipClass =
  "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-medium leading-none";

export function RecipeTagBadges({
  tags,
  mealTypes = [],
  pantry,
  cookTimeMinutes,
  serves,
  className,
}: {
  tags: RecipeTag[];
  mealTypes?: RecipeMealType[];
  pantry?: RecipePantryStatus;
  cookTimeMinutes?: number | null;
  serves?: string | null;
  className?: string;
}) {
  const showPantry = pantry && pantry.totalRequired > 0;
  const cookTimeLabel = formatCookTime(cookTimeMinutes);
  const servesLabel = serves?.trim() || null;
  if (!showPantry && !cookTimeLabel && !servesLabel && mealTypes.length === 0 && tags.length === 0)
    return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {servesLabel && (
        <span
          className={cn(recipeChipClass, "border-border bg-muted/60 text-muted-foreground")}
          title="Serves"
        >
          <Users className="h-3 w-3 shrink-0" aria-hidden />
          Serves {servesLabel}
        </span>
      )}
      {showPantry && (
        <span
          className={cn(
            recipeChipClass,
            "tabular-nums",
            pantry.haveAll
              ? "border-success/40 bg-success/15 text-success"
              : "border-border bg-muted/60 text-muted-foreground",
          )}
          title={`${pantry.haveRequired} of ${pantry.totalRequired} required ingredients in pantry`}
        >
          <Carrot className="h-3 w-3 shrink-0" aria-hidden />
          {pantry.haveRequired}/{pantry.totalRequired}
          <span className="sr-only"> in pantry</span>
        </span>
      )}
      {cookTimeLabel && (
        <span
          className={cn(recipeChipClass, "border-border bg-muted/60 text-muted-foreground")}
          title="Cook time"
        >
          <Clock className="h-3 w-3 shrink-0" aria-hidden />
          {cookTimeLabel}
        </span>
      )}
      {mealTypes.length > 0 && (
        <span
          className={cn(recipeChipClass, "border-border bg-muted/60 text-muted-foreground")}
          title="Meal types"
        >
          <UtensilsCrossed className="h-3 w-3 shrink-0" aria-hidden />
          {formatMealTypesLabel(mealTypes)}
        </span>
      )}
      {tags.map((tag) => {
        const Icon = TAG_ICONS[tag];
        return (
          <span
            key={tag}
            className={cn(recipeChipClass, "border-border bg-muted/60 text-muted-foreground")}
          >
            <Icon className="h-3 w-3 shrink-0" aria-hidden />
            {tag}
          </span>
        );
      })}
    </div>
  );
}
