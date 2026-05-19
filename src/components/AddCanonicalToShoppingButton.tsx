import type { MouseEvent } from "react";
import { Carrot, Plus, ShoppingBasket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ShoppingItem } from "@/hooks/useTable";
import { cap } from "@/lib/text";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  canonicalId: string;
  name: string;
  shopping: ShoppingItem[];
  inPantry?: boolean;
  onAdded: () => void;
  className?: string;
  disabled?: boolean;
};

export function AddCanonicalToShoppingButton({
  canonicalId,
  name,
  shopping,
  inPantry = false,
  onAdded,
  className,
  disabled: externalDisabled,
}: Props) {
  const onList = shopping.some((s) => s.canonical_id === canonicalId);
  const disabled = externalDisabled;

  if (inPantry) {
    return (
      <span
        className={cn("inline-flex p-0.5", className)}
        aria-label={`${cap(name)} is in your pantry`}
        title="In your pantry"
      >
        <Carrot className="h-3 w-3 shrink-0" />
      </span>
    );
  }

  if (onList) {
    return (
      <span
        className={cn("inline-flex p-0.5 text-basket-foreground", className)}
        aria-label={`${cap(name)} is on your shopping list`}
        title="In your shopping list"
      >
        <ShoppingBasket className="h-3 w-3 shrink-0 opacity-80" />
      </span>
    );
  }

  const add = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    const { error } = await supabase.from("shopping_list").insert({
      name,
      canonical_id: canonicalId,
    });
    if (error) return toast.error(error.message);
    toast.success(`Added ${cap(name)} to shopping list`);
    onAdded();
  };

  return (
    <button
      type="button"
      onClick={(e) => void add(e)}
      disabled={disabled}
      aria-label={
        onList ? `${cap(name)} is already on the shopping list` : `Add ${cap(name)} to shopping list`
      }
      title={onList ? "Already on shopping list" : "Add to shopping list"}
      className={cn(
        "rounded p-0.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary",
        className,
      )}
    >
      <Plus className="h-3 w-3 shrink-0" />
    </button>
  );
}
