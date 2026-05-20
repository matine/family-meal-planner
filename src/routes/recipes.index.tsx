import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  BookOpen,
  CalendarCheck,
  CalendarPlus,
  Plus,
  Sparkles,
  Link as LinkIcon,
  Image as ImageIcon,
  Type,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTable, type Ingredient, type MealPlanRow, type Recipe } from "@/hooks/useTable";
import { RecipeFilterBar } from "@/components/RecipeFilterBar";
import { RecipeCardMeta } from "@/components/RecipeCardMeta";
import { buildRecipeCardMetaItems } from "@/lib/recipe-card-meta";
import {
  getRecipePantryStatus,
  parseCookTimeMinutes,
  parseRecipeTags,
  recipeMatchesCookTimeFilter,
  recipeMatchesInPantryFilter,
  recipeMatchesTagFilter,
  type CookTimeFilterMax,
  type RecipeTag,
} from "@/lib/recipe-tags";
import {
  parseMealTypes,
  recipeMatchesMealTypeFilter,
  type RecipeMealType,
} from "@/lib/recipe-meal-types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type MealType = "breakfast" | "lunch" | "dinner";
const MEAL_TYPES: { key: MealType; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
];

async function quickAddToPlanner(recipeId: string, mealType: MealType) {
  const { error } = await supabase
    .from("meal_plan")
    .insert({ recipe_id: recipeId, meal_type: mealType });
  if (error) return toast.error(error.message);
  toast.success(`Added to ${mealType}`);
}

export const Route = createFileRoute("/recipes/")({
  component: RecipesPage,
  head: () => ({
    meta: [
      { title: "Recipes — Family Kitchen" },
      { name: "description", content: "Your favourite family recipes, all in one place." },
    ],
  }),
});

const ADD_RECIPE_OPTIONS = [
  { mode: "manual" as const, label: "Manual", icon: Type },
  { mode: "url" as const, label: "From URL", icon: LinkIcon },
  { mode: "photo" as const, label: "From photo", icon: ImageIcon },
  { mode: "text" as const, label: "Paste text", icon: Sparkles },
];

function RecipesPage() {
  const navigate = useNavigate();
  const { rows: recipes } = useTable<Recipe>("recipes");
  const { rows: planRows, refresh: refreshPlan } = useTable<MealPlanRow>("meal_plan");
  const { rows: pantry } = useTable<Ingredient>("ingredients");
  const [tagFilters, setTagFilters] = useState<RecipeTag[]>([]);
  const [inPantryFilter, setInPantryFilter] = useState(false);
  const [cookTimeFilter, setCookTimeFilter] = useState<CookTimeFilterMax | null>(null);
  const [mealTypeFilters, setMealTypeFilters] = useState<RecipeMealType[]>([]);

  // Quick lookup of which recipes are already in the planner (any meal type).
  const plannedRecipeIds = new Set(
    planRows.map((p) => p.recipe_id).filter((id): id is string => !!id),
  );

  // Set of canonical ingredient ids the user has in their pantry, used to
  // compute "have X of Y" per recipe (same matching rule as the detail page).
  const pantryCanonicalIds = useMemo(
    () => new Set(pantry.map((p) => p.canonical_id).filter((id): id is string => !!id)),
    [pantry],
  );

  const filteredRecipes = useMemo(() => {
    return recipes.filter((r) => {
      const tags = parseRecipeTags(r.tags);
      const mealTypes = parseMealTypes(r.meal_types);
      if (!recipeMatchesTagFilter(tags, tagFilters)) return false;
      if (!recipeMatchesMealTypeFilter(mealTypes, mealTypeFilters)) return false;
      const pantryStatus = getRecipePantryStatus(r, pantryCanonicalIds);
      if (!recipeMatchesInPantryFilter(pantryStatus, inPantryFilter)) return false;
      return recipeMatchesCookTimeFilter(
        r.cook_time_minutes,
        cookTimeFilter != null ? [cookTimeFilter] : [],
      );
    });
  }, [recipes, tagFilters, mealTypeFilters, inPantryFilter, cookTimeFilter, pantryCanonicalIds]);

  const filtersActive =
    tagFilters.length > 0 ||
    mealTypeFilters.length > 0 ||
    inPantryFilter ||
    cookTimeFilter != null;

  const handleAddToPlanner = async (recipeId: string, mealType: MealType) => {
    await quickAddToPlanner(recipeId, mealType);
    refreshPlan();
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recipes</h1>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" /> Add recipe
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Add recipe</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ADD_RECIPE_OPTIONS.map(({ mode, label, icon: Icon }) => (
              <DropdownMenuItem
                key={mode}
                onSelect={() => navigate({ to: "/recipes/new/$mode", params: { mode } })}
              >
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {recipes.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <RecipeFilterBar
            tagFilters={tagFilters}
            inPantryFilter={inPantryFilter}
            cookTimeFilter={cookTimeFilter}
            mealTypeFilters={mealTypeFilters}
            onTagFiltersChange={setTagFilters}
            onMealTypeFiltersChange={setMealTypeFilters}
            onInPantryFilterChange={setInPantryFilter}
            onCookTimeFilterChange={setCookTimeFilter}
          />
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setTagFilters([]);
                setMealTypeFilters([]);
                setInPantryFilter(false);
                setCookTimeFilter(null);
              }}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {recipes.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-[var(--gradient-warm)] p-10 text-center">
          <BookOpen className="mx-auto mb-3 h-10 w-10 text-primary" />
          <p className="font-medium">No recipes yet</p>
          <p className="text-sm text-muted-foreground">
            Snap a cookbook page, paste a link, or type one in.
          </p>
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-muted/30 p-10 text-center">
          <p className="font-medium">No recipes match these filters</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try clearing filters or choosing different tags.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredRecipes.map((r) => {
            const inPlanner = plannedRecipeIds.has(r.id);
            const cookTimeMinutes = parseCookTimeMinutes(r.cook_time_minutes);
            const pantryStatus = getRecipePantryStatus(r, pantryCanonicalIds);
            const metaItems = buildRecipeCardMetaItems({
              cookTimeMinutes,
              pantryStatus,
            });
            return (
              <Link
                key={r.id}
                to="/recipes/$id"
                params={{ id: r.id }}
                className="relative rounded-2xl border bg-card py-4 pl-4 pr-3 shadow-[var(--shadow-card)] transition hover:border-primary/40 hover:shadow-[var(--shadow-soft)] sm:py-4 sm:pl-5 sm:pr-3.5"
              >
                <div className="flex items-start gap-4">
                  {r.image_url ? (
                    <img
                      src={r.image_url}
                      alt={r.title}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-secondary text-2xl">
                      🍽️
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate pr-7 font-semibold leading-snug">{r.title}</h3>
                    <RecipeCardMeta items={metaItems} />
                  </div>
                </div>
                <div className="absolute right-2 top-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        disabled={inPlanner}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        className={`rounded-md p-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          inPlanner
                            ? "cursor-not-allowed text-muted-foreground/50"
                            : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        }`}
                        aria-label={inPlanner ? "Already in planner" : "Add to planner"}
                        title={inPlanner ? "Already in planner" : "Add to planner"}
                      >
                        {inPlanner ? (
                          <CalendarCheck className="h-4 w-4" />
                        ) : (
                          <CalendarPlus className="h-4 w-4" />
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuLabel>Add to planner</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {MEAL_TYPES.map((m) => (
                        <DropdownMenuItem
                          key={m.key}
                          onSelect={() => {
                            void handleAddToPlanner(r.id, m.key);
                          }}
                        >
                          {m.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
