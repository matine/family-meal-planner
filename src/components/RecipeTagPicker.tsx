import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RECIPE_TAGS, isRecipeTag, type RecipeTag } from "@/lib/recipe-tags";
import { cn } from "@/lib/utils";

export function RecipeTagPicker({
  value,
  onChange,
  disabled,
  className,
  label = "Tags",
}: {
  value: RecipeTag[];
  onChange: (tags: RecipeTag[]) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <ToggleGroup
        type="multiple"
        value={value}
        onValueChange={(next) => onChange(next.filter(isRecipeTag))}
        className="flex flex-wrap justify-start gap-1.5"
        disabled={disabled}
      >
        {RECIPE_TAGS.map((tag) => (
          <ToggleGroupItem
            key={tag}
            value={tag}
            aria-label={tag}
            className="h-7 rounded-full border px-3 text-xs data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          >
            {tag}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

