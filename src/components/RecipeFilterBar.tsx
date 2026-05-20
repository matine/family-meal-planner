import { Carrot, Clock } from "lucide-react";
import { RecipeFilterChip, filterChipClass } from "@/components/RecipeFilterChip";
import { RecipeMealTypesSelect } from "@/components/RecipeMealTypesSelect";
import type { RecipeMealType } from "@/lib/recipe-meal-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { ToggleGroup } from "@/components/ui/toggle-group";
import {
  COOK_TIME_FILTER_MAX_MINUTES,
  IN_PANTRY_FILTER,
  RECIPE_TAGS,
  TAG_ICONS,
  formatCookTimeFilter,
  isRecipeTag,
  type CookTimeFilterMax,
  type RecipeTag,
} from "@/lib/recipe-tags";
import { cn } from "@/lib/utils";

const COOK_TIME_SELECT_ANY = "any";

export function RecipeFilterBar({
  tagFilters,
  mealTypeFilters,
  inPantryFilter,
  cookTimeFilter,
  onTagFiltersChange,
  onMealTypeFiltersChange,
  onInPantryFilterChange,
  onCookTimeFilterChange,
  className,
}: {
  tagFilters: RecipeTag[];
  mealTypeFilters: RecipeMealType[];
  inPantryFilter: boolean;
  cookTimeFilter: CookTimeFilterMax | null;
  onTagFiltersChange: (tags: RecipeTag[]) => void;
  onMealTypeFiltersChange: (meals: RecipeMealType[]) => void;
  onInPantryFilterChange: (active: boolean) => void;
  onCookTimeFilterChange: (maxMinutes: CookTimeFilterMax | null) => void;
  className?: string;
}) {
  const toggleValue = [...(inPantryFilter ? [IN_PANTRY_FILTER] : []), ...tagFilters];

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <Select
        value={cookTimeFilter != null ? String(cookTimeFilter) : COOK_TIME_SELECT_ANY}
        onValueChange={(value) => {
          if (value === COOK_TIME_SELECT_ANY) {
            onCookTimeFilterChange(null);
            return;
          }
          const minutes = Number(value);
          if (COOK_TIME_FILTER_MAX_MINUTES.includes(minutes as CookTimeFilterMax)) {
            onCookTimeFilterChange(minutes as CookTimeFilterMax);
          }
        }}
      >
        <SelectTrigger
          aria-label="Cook time"
          className={cn(
            filterChipClass,
            "h-7 w-auto gap-1 bg-background px-3 shadow-none focus:ring-1 [&>svg:last-child]:h-3.5 [&>svg:last-child]:w-3.5 [&>svg:last-child]:opacity-60",
            cookTimeFilter != null && "border-primary bg-primary/10 text-primary",
          )}
        >
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="text-xs font-medium">
            {cookTimeFilter != null ? formatCookTimeFilter(cookTimeFilter) : "Cook time"}
          </span>
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem value={COOK_TIME_SELECT_ANY}>Any time</SelectItem>
          {COOK_TIME_FILTER_MAX_MINUTES.map((max) => (
            <SelectItem key={max} value={String(max)}>
              {formatCookTimeFilter(max)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <RecipeMealTypesSelect value={mealTypeFilters} onChange={onMealTypeFiltersChange} />

      <ToggleGroup
        type="multiple"
        value={toggleValue}
        onValueChange={(next) => {
          onInPantryFilterChange(next.includes(IN_PANTRY_FILTER));
          onTagFiltersChange(next.filter(isRecipeTag));
        }}
        className="flex flex-wrap justify-start gap-1.5"
      >
        <RecipeFilterChip value={IN_PANTRY_FILTER} label="In pantry" icon={Carrot} />
        {RECIPE_TAGS.map((tag) => (
          <RecipeFilterChip key={tag} value={tag} label={tag} icon={TAG_ICONS[tag]} />
        ))}
      </ToggleGroup>
    </div>
  );
}
