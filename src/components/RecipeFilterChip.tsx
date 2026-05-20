import type { LucideIcon } from "lucide-react";
import { ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export const filterChipClass =
  "h-7 gap-1 rounded-full border px-3 text-xs data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary";

export function RecipeFilterChip({
  value,
  label,
  icon: Icon,
  className,
}: {
  value: string;
  label: string;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <ToggleGroupItem value={value} aria-label={label} className={cn(filterChipClass, className)}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </ToggleGroupItem>
  );
}
