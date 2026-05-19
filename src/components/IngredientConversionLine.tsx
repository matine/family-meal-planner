import { type RecipeIngredient } from "@/hooks/useTable";
import { formatConvertedIngredientDisplay } from "@/lib/recipe-ingredient";
import { normalizeIngredientLine } from "@/lib/ingredient-normalize";
import { InlineEditableText } from "@/components/InlineEditableText";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  ingredient: RecipeIngredient;
  disabled?: boolean;
  className?: string;
  onCommit: (next: RecipeIngredient) => void;
};

export function IngredientConversionLine({ ingredient, disabled, className, onCommit }: Props) {
  const source = ingredient.sourceLine?.trim() ?? "";
  const converted = formatConvertedIngredientDisplay(ingredient);

  const commitConverted = (trimmed: string) => {
    if (!trimmed) {
      toast.error("Converted line cannot be empty");
      return;
    }
    const parts = normalizeIngredientLine(trimmed);
    if (!parts.name.trim()) {
      toast.error("Could not read an ingredient name from that line");
      return;
    }
    const sl = ingredient.sourceLine?.trim();
    const ol = ingredient.originalLine?.trim();
    onCommit({
      name: parts.name,
      amount: parts.amount,
      preparation: parts.preparation,
      ...(sl ? { sourceLine: sl } : {}),
      ...(ol ? { originalLine: ol } : {}),
      ...(ingredient.canonicalId ? { canonicalId: ingredient.canonicalId } : {}),
      ...(ingredient.canonicalIds?.length ? { canonicalIds: ingredient.canonicalIds } : {}),
      ...(ingredient.optional ? { optional: true } : {}),
    });
  };

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 text-left sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2 sm:gap-y-1",
        className,
      )}
    >
      <span className="min-w-0 break-words leading-snug text-muted-foreground">{source}</span>
      <span className="shrink-0 text-muted-foreground" aria-hidden>
        →
      </span>
      <InlineEditableText
        wrap
        value={converted}
        disabled={disabled}
        ariaLabel="Edit converted ingredient line"
        onCommit={commitConverted}
      />
    </div>
  );
}
