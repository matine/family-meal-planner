import { Carrot } from "lucide-react";
import { type RecipePantryStatus, type RecipeTag } from "@/lib/recipe-tags";
import { cn } from "@/lib/utils";

export const recipeChipClass =
  "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-medium leading-none";

export function RecipeTagBadges({
  tags,
  pantry,
  className,
}: {
  tags: RecipeTag[];
  pantry?: RecipePantryStatus;
  className?: string;
}) {
  const showPantry = pantry && pantry.totalRequired > 0;
  if (!showPantry && tags.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
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
      {tags.map((tag) => (
        <span
          key={tag}
          className={cn(recipeChipClass, "border-border bg-muted/60 text-muted-foreground")}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
