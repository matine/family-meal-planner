import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, ShoppingBasket, CalendarCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  useTable,
  type Ingredient,
  type MealPlanRow,
  type Recipe,
  type ShoppingItem,
} from "@/hooks/useTable";
import { useCanonicals } from "@/hooks/useCanonicals";
import {
  buildPlannerIngredientIndex,
  plannerRecipesForShoppingItem,
  type PlannerRecipeRef,
} from "@/lib/planner-ingredients";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IngredientPredictiveInput } from "@/components/IngredientPredictiveInput";
import { resolveOrCreateCanonical } from "@/lib/canonical";
import { isInPantry } from "@/lib/pantry";
import { cap } from "@/lib/text";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: ShoppingPage,
  head: () => ({ meta: [{ title: "Shopping List — Family Kitchen" }] }),
});

function ShoppingPage() {
  const { rows, refresh } = useTable<ShoppingItem>("shopping_list");
  const { rows: pantryRows } = useTable<Ingredient>("ingredients");
  const { rows: planRows } = useTable<MealPlanRow>("meal_plan");
  const { rows: recipes } = useTable<Recipe>("recipes");
  const { rows: canonicals } = useCanonicals();
  const canonicalById = useMemo(() => {
    const m = new Map<string, string>();
    canonicals.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [canonicals]);

  const plannerIngredientIndex = useMemo(() => {
    const recipesById = new Map(recipes.map((r) => [r.id, r]));
    return buildPlannerIngredientIndex(planRows, recipesById);
  }, [planRows, recipes]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  const displayName = (it: ShoppingItem) =>
    cap(it.canonical_id ? (canonicalById.get(it.canonical_id) ?? it.name) : it.name);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const can = await resolveOrCreateCanonical(name, canonicals);
      if (!can) return toast.error("Couldn't add — invalid name");
      const { error } = await supabase
        .from("shopping_list")
        .insert({ name: can.name, canonical_id: can.id, amount: amount.trim() || null });
      if (error) return toast.error(error.message);
      setName("");
      setAmount("");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Add failed");
    }
  };

  const toggle = async (item: ShoppingItem) => {
    await supabase.from("shopping_list").update({ checked: !item.checked }).eq("id", item.id);
    refresh();
  };

  const remove = async (id: string) => {
    await supabase.from("shopping_list").delete().eq("id", id);
    refresh();
  };

  const clearChecked = async () => {
    await supabase.from("shopping_list").delete().eq("checked", true);
    toast.success("Cleared checked items");
    refresh();
  };

  const moveCheckedToPantry = async () => {
    const checked = rows.filter((r) => r.checked);
    if (!checked.length) return toast.info("Nothing checked off yet.");
    const canonicalIds = Array.from(
      new Set(checked.map((c) => c.canonical_id).filter((id): id is string => !!id)),
    );
    const lastCategoryById = new Map<string, string | null>();
    if (canonicalIds.length) {
      const { data } = await supabase
        .from("canonical_ingredients")
        .select("id, last_category")
        .in("id", canonicalIds);
      for (const r of data ?? []) lastCategoryById.set(r.id, r.last_category);
    }
    const toMove = checked.filter((c) => {
      const itemName = c.canonical_id ? (canonicalById.get(c.canonical_id) ?? c.name) : c.name;
      return !isInPantry(pantryRows, { canonicalId: c.canonical_id, name: itemName });
    });
    const skipped = checked.length - toMove.length;

    if (toMove.length) {
      const inserts = toMove.map((c) => ({
        name: c.canonical_id ? (canonicalById.get(c.canonical_id) ?? c.name) : c.name,
        amount: c.amount,
        canonical_id: c.canonical_id,
        category: c.canonical_id ? (lastCategoryById.get(c.canonical_id) ?? null) : null,
      }));
      const { error } = await supabase.from("ingredients").insert(inserts as any);
      if (error) return toast.error(error.message);
    }

    await supabase.from("shopping_list").delete().eq("checked", true);

    if (toMove.length && skipped) {
      toast.success(
        `Added ${toMove.length} to pantry${skipped === 1 ? " (1 already there)" : ` (${skipped} already there)`}`,
      );
    } else if (toMove.length) {
      toast.success(`Moved ${toMove.length} item${toMove.length === 1 ? "" : "s"} to pantry`);
    } else {
      toast.info(
        skipped === 1
          ? "Already in your pantry — removed from shopping list"
          : "Those items are already in your pantry — removed from shopping list",
      );
    }
    refresh();
  };

  const checkedCount = rows.filter((r) => r.checked).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Shopping List</h1>
      </header>

      <form
        onSubmit={add}
        className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] sm:flex-row"
      >
        <IngredientPredictiveInput
          canonicals={canonicals}
          value={name}
          onChange={setName}
          placeholder="Item"
          className="flex-1"
        />
        <Input
          placeholder="Amount (optional)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="sm:w-44"
        />
        <Button type="submit" className="gap-1.5">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-[var(--gradient-warm)] p-10 text-center">
          <ShoppingBasket className="mx-auto mb-3 h-10 w-10 text-primary" />
          <p className="font-medium">List is empty</p>
          <p className="text-sm text-muted-foreground">
            Add items above or from a recipe page.
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y rounded-2xl border bg-card shadow-[var(--shadow-card)]">
            {rows.map((it) => (
              <ShoppingRow
                key={it.id}
                item={it}
                displayName={displayName(it)}
                plannerRecipes={plannerRecipesForShoppingItem(plannerIngredientIndex, it)}
                onToggle={() => toggle(it)}
                onRemove={() => remove(it.id)}
              />
            ))}
          </ul>

          {checkedCount > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={moveCheckedToPantry} variant="default">
                Move {checkedCount} to pantry
              </Button>
              <Button onClick={clearChecked} variant="outline">
                Clear checked
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ShoppingRow({
  item,
  displayName,
  plannerRecipes,
  onToggle,
  onRemove,
}: {
  item: ShoppingItem;
  displayName: string;
  plannerRecipes: PlannerRecipeRef[];
  onToggle: () => void;
  onRemove: () => void;
}) {
  const [editingAmount, setEditingAmount] = useState(false);
  const [amountValue, setAmountValue] = useState(item.amount ?? "");

  const saveAmount = async () => {
    const next = amountValue.trim() || null;
    if (next !== (item.amount ?? null)) {
      const { error } = await supabase
        .from("shopping_list")
        .update({ amount: next })
        .eq("id", item.id);
      if (error) {
        toast.error(error.message);
        setAmountValue(item.amount ?? "");
        setEditingAmount(false);
        return;
      }
    }
    setEditingAmount(false);
  };

  return (
    <li className="group flex items-center gap-3 px-4 py-3">
      <Checkbox checked={item.checked} onCheckedChange={onToggle} className="h-5 w-5" />
      <div className={cn("flex-1", item.checked && "text-muted-foreground")}>
        <div className="flex items-center gap-2">
          <span className={cn("font-medium", item.checked && "line-through")}>{displayName}</span>
          {editingAmount ? (
            <Input
              autoFocus
              value={amountValue}
              onChange={(e) => setAmountValue(e.target.value)}
              onBlur={saveAmount}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveAmount();
                }
                if (e.key === "Escape") {
                  setAmountValue(item.amount ?? "");
                  setEditingAmount(false);
                }
              }}
              placeholder="Amount"
              className="h-7 w-32 px-2 py-1 text-base md:text-xs"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingAmount(true)}
              className="rounded px-1 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Edit amount for ${displayName}`}
            >
              {item.amount || <span className="italic opacity-60">add amount</span>}
            </button>
          )}
        </div>
        {plannerRecipes.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-muted-foreground">
            <CalendarCheck className="h-3 w-3 shrink-0 text-primary/80" aria-hidden />
            <span className="sr-only">In meal planner:</span>
            {plannerRecipes.map((recipe, i) => (
              <span key={recipe.id} className="inline-flex flex-wrap items-center gap-x-1">
                {i > 0 && <span aria-hidden>·</span>}
                <Link
                  to="/recipes/$id"
                  params={{ id: recipe.id }}
                  className="font-medium text-primary hover:underline"
                >
                  {recipe.title}
                </Link>
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onRemove}
        className="rounded p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
