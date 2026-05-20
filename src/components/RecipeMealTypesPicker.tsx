import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  MEAL_TYPE_ICONS,
  MEAL_TYPE_LABELS,
  MEAL_TYPES,
  isRecipeMealType,
  type RecipeMealType,
} from "@/lib/recipe-meal-types";
import { cn } from "@/lib/utils";

const mealChipClass =
  "h-7 gap-1 rounded-full border px-3 text-xs data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary";

/** Toggle chips only — wrap with {@link RecipeFormField} for a label. */
export function RecipeMealTypesPicker({
  value,
  onChange,
  disabled,
  className,
}: {
  value: RecipeMealType[];
  onChange: (meals: RecipeMealType[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <ToggleGroup
      type="multiple"
      value={value}
      onValueChange={(next) => onChange(next.filter(isRecipeMealType))}
      className={cn("flex flex-wrap justify-start gap-1.5", className)}
      disabled={disabled}
    >
      {MEAL_TYPES.map((meal) => {
        const Icon = MEAL_TYPE_ICONS[meal];
        return (
          <ToggleGroupItem
            key={meal}
            value={meal}
            aria-label={MEAL_TYPE_LABELS[meal]}
            className={mealChipClass}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {MEAL_TYPE_LABELS[meal]}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
