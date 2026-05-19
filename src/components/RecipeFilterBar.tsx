import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { IN_PANTRY_FILTER, RECIPE_TAGS, isRecipeTag, type RecipeTag } from "@/lib/recipe-tags";
import { cn } from "@/lib/utils";

const filterChipClass =
  "h-7 rounded-full border px-3 text-xs data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary";

export function RecipeFilterBar({
  tagFilters,
  inPantryFilter,
  onTagFiltersChange,
  onInPantryFilterChange,
  className,
}: {
  tagFilters: RecipeTag[];
  inPantryFilter: boolean;
  onTagFiltersChange: (tags: RecipeTag[]) => void;
  onInPantryFilterChange: (active: boolean) => void;
  className?: string;
}) {
  const value = [...tagFilters, ...(inPantryFilter ? [IN_PANTRY_FILTER] : [])];

  return (
    <ToggleGroup
      type="multiple"
      value={value}
      onValueChange={(next) => {
        onTagFiltersChange(next.filter(isRecipeTag));
        onInPantryFilterChange(next.includes(IN_PANTRY_FILTER));
      }}
      className={cn("flex flex-wrap justify-start gap-1.5", className)}
    >
      {RECIPE_TAGS.map((tag) => (
        <ToggleGroupItem key={tag} value={tag} aria-label={tag} className={filterChipClass}>
          {tag}
        </ToggleGroupItem>
      ))}
      <ToggleGroupItem value={IN_PANTRY_FILTER} aria-label="In pantry" className={filterChipClass}>
        In pantry
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
