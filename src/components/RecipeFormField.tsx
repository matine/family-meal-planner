import { cn } from "@/lib/utils";

export const recipeFormLabelClass = "text-sm font-medium text-muted-foreground";

export function RecipeFormField({
  label,
  children,
  className,
  required,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className={recipeFormLabelClass}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </p>
      {children}
    </div>
  );
}
