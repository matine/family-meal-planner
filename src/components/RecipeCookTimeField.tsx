import { Input } from "@/components/ui/input";
import { parseCookTimeMinutes } from "@/lib/recipe-tags";
import { cn } from "@/lib/utils";

/** Minutes input only — wrap with {@link RecipeFormField} for a label. */
export function RecipeCookTimeField({
  value,
  onChange,
  disabled,
  className,
}: {
  value: number | null;
  onChange: (minutes: number | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Input
      type="number"
      min={1}
      inputMode="numeric"
      placeholder="e.g. 30"
      value={value ?? ""}
      onChange={(e) => {
        const raw = e.target.value.trim();
        onChange(raw === "" ? null : parseCookTimeMinutes(raw));
      }}
      className={cn("w-full", className)}
      disabled={disabled}
    />
  );
}
