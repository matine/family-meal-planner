import { cn } from "@/lib/utils";

export const recipeFormLabelClass = "text-sm font-medium text-muted-foreground";

export function RecipeFormField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className={recipeFormLabelClass}>{label}</p>
      {children}
    </div>
  );
}
