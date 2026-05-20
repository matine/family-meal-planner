import { ChevronDown, UtensilsCrossed } from "lucide-react";
import { filterChipClass } from "@/components/RecipeFilterChip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MEAL_TYPE_ICONS,
  MEAL_TYPE_LABELS,
  MEAL_TYPES,
  mealTypesSummary,
  toggleMealType,
  type RecipeMealType,
} from "@/lib/recipe-meal-types";
import { cn } from "@/lib/utils";

export function RecipeMealTypesSelect({
  value,
  onChange,
  disabled,
  className,
  label,
}: {
  value: RecipeMealType[];
  onChange: (meals: RecipeMealType[]) => void;
  disabled?: boolean;
  className?: string;
  /** Shown above the control on recipe forms; omit on the filter bar. */
  label?: string;
}) {
  const active = value.length > 0;

  return (
    <div className={cn(label ? "space-y-2" : undefined, className)}>
      {label && <p className="text-sm font-medium text-muted-foreground">{label}</p>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            type="button"
            aria-label="Meals"
            className={cn(
              filterChipClass,
              "inline-flex h-7 items-center gap-1 bg-background shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              active && "border-primary bg-primary/10 text-primary",
            )}
          >
            <UtensilsCrossed className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="text-xs font-medium">{mealTypesSummary(value)}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[10rem]">
          {MEAL_TYPES.map((meal) => {
            const Icon = MEAL_TYPE_ICONS[meal];
            return (
              <DropdownMenuCheckboxItem
                key={meal}
                checked={value.includes(meal)}
                onCheckedChange={() => onChange(toggleMealType(value, meal))}
                onSelect={(e) => e.preventDefault()}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  {MEAL_TYPE_LABELS[meal]}
                </span>
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
