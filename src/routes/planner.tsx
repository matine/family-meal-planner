import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2, Sun, Sunset, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTable, type MealPlanRow, type Recipe } from "@/hooks/useTable";
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

function PlannerPage() {
  const { rows: plan, refresh } = useTable<MealPlanRow>("meal_plan");
  const [recipes, setRecipes] = useState<Record<string, Recipe>>({});

  useEffect(() => {
    supabase
      .from("recipes")
      .select("*")
      .then(({ data }) => {
        const map: Record<string, Recipe> = {};
        (data ?? []).forEach((r) => (map[r.id] = r as Recipe));
        setRecipes(map);
      });
  }, [plan]);

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
            <section
              key={key}
              className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]"
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <h2 className="font-semibold">{label}</h2>
                <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
              </div>
              {items.length === 0 ? (
                <p className="rounded-lg bg-muted/50 px-3 py-4 text-center text-xs text-muted-foreground">
                  No {label.toLowerCase()} planned
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((p) => {
                    const r = p.recipe_id ? recipes[p.recipe_id] : null;
                    return (
                      <li
                        key={p.id}
                        className="group flex items-center justify-between rounded-lg border bg-background px-3 py-2"
                      >
                        {r ? (
                          <Link
                            to="/recipes/$id"
                            params={{ id: r.id }}
                            className="truncate text-sm font-medium hover:text-primary"
                          >
                            {r.title}
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">Recipe missing</span>
                        )}
                        <button
                          onClick={() => remove(p.id)}
                          aria-label="Remove from planner"
                          className="rounded p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <div className="rounded-xl border border-dashed bg-[var(--gradient-warm)] p-4 text-center text-sm text-muted-foreground">
        Add meals from any recipe page using the{" "}
        <strong className="text-foreground">Add to planner</strong> button.
      </div>
    </div>
  );
}
