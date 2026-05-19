import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Trash2, Sun, Sunset, Moon, Plus, BookOpen, PenLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTable, type MealPlanRow, type Recipe } from "@/hooks/useTable";
import { PlannerMealInput } from "@/components/PlannerMealInput";
import { Button } from "@/components/ui/button";
import type { RecipeLite } from "@/lib/recipe-suggest";
import { toast } from "sonner";

export const Route = createFileRoute("/planner")({
  component: PlannerPage,
  head: () => ({ meta: [{ title: "Meal Planner — Family Kitchen" }] }),
});

const MEALS = [
  { key: "breakfast", label: "Breakfast", icon: Sun },
  { key: "lunch", label: "Lunch", icon: Sunset },
  { key: "dinner", label: "Dinner", icon: Moon },
] as const;

type MealType = (typeof MEALS)[number]["key"];

function PlannerPage() {
  const { rows: plan, refresh } = useTable<MealPlanRow>("meal_plan");
  const { rows: allRecipes } = useTable<Recipe>("recipes");

  const recipesById = useMemo(() => {
    const map: Record<string, Recipe> = {};
    allRecipes.forEach((r) => (map[r.id] = r));
    return map;
  }, [allRecipes]);

  const recipeOptions: RecipeLite[] = useMemo(
    () => allRecipes.map((r) => ({ id: r.id, title: r.title })),
    [allRecipes],
  );

  const remove = async (id: string) => {
    const { error } = await supabase.from("meal_plan").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Meal Planner</h1>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {MEALS.map(({ key, label, icon: Icon }) => {
          const items = plan.filter((p) => p.meal_type === key);
          return (
            <MealColumn
              key={key}
              mealType={key}
              label={label}
              icon={Icon}
              items={items}
              recipes={recipesById}
              recipeOptions={recipeOptions}
              onRemove={remove}
              onAdded={refresh}
            />
          );
        })}
      </div>

      <div className="rounded-xl border border-dashed bg-[var(--gradient-warm)] p-4 text-center text-sm text-muted-foreground">
        Search for a recipe or add a quick note in each column — no recipe needed for notes.
      </div>
    </div>
  );
}

function MealColumn({
  mealType,
  label,
  icon: Icon,
  items,
  recipes,
  recipeOptions,
  onRemove,
  onAdded,
}: {
  mealType: MealType;
  label: string;
  icon: typeof Sun;
  items: MealPlanRow[];
  recipes: Record<string, Recipe>;
  recipeOptions: RecipeLite[];
  onRemove: (id: string) => void;
  onAdded: () => void;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="font-semibold">{label}</h2>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg bg-muted/50 px-3 py-4 text-center text-xs text-muted-foreground">
          No {label.toLowerCase()} planned
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <PlannerItem key={p.id} item={p} recipes={recipes} onRemove={() => onRemove(p.id)} />
          ))}
        </ul>
      )}
      <PlannerMealAdd mealType={mealType} recipeOptions={recipeOptions} onAdded={onAdded} />
    </section>
  );
}

function PlannerItem({
  item,
  recipes,
  onRemove,
}: {
  item: MealPlanRow;
  recipes: Record<string, Recipe>;
  onRemove: () => void;
}) {
  const quickLabel = item.label?.trim();
  const recipe = item.recipe_id ? recipes[item.recipe_id] : null;

  return (
    <li className="group flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {recipe ? (
          <>
            <BookOpen
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <Link
              to="/recipes/$id"
              params={{ id: recipe.id }}
              className="truncate text-sm font-medium hover:text-primary"
            >
              {recipe.title}
            </Link>
          </>
        ) : quickLabel ? (
          <>
            <PenLine className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate text-sm font-medium">{quickLabel}</span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Recipe missing</span>
        )}
      </div>
      <button
        onClick={onRemove}
        aria-label="Remove from planner"
        className="rounded p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function PlannerMealAdd({
  mealType,
  recipeOptions,
  onAdded,
}: {
  mealType: MealType;
  recipeOptions: RecipeLite[];
  onAdded: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const insert = async (payload: { recipe_id: string } | { label: string }) => {
    setBusy(true);
    const { error } = await supabase.from("meal_plan").insert({
      meal_type: mealType,
      ...payload,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setText("");
    onAdded();
  };

  return (
    <div className="mt-3 flex gap-1.5">
      <PlannerMealInput
        recipes={recipeOptions}
        value={text}
        onChange={setText}
        disabled={busy}
        onPickRecipe={(r) => insert({ recipe_id: r.id })}
        onQuickAdd={(label) => insert({ label })}
      />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={busy || !text.trim()}
        className="h-8 shrink-0 px-2.5"
        aria-label={`Add to ${mealType}`}
        onClick={() => {
          const q = text.trim();
          if (!q) return;
          const match = recipeOptions.find((r) => r.title.toLowerCase() === q.toLowerCase());
          if (match) insert({ recipe_id: match.id });
          else insert({ label: q });
        }}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
