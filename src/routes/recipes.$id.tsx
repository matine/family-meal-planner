import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarCheck,
  Carrot,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  ShoppingBasket,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  useTable,
  type Ingredient,
  type MealPlanRow,
  type Recipe,
  type RecipeIngredient,
  type ShoppingItem,
} from "@/hooks/useTable";
import {
  formatOriginalIngredientLine,
  ingredientCanonicalIds,
  partitionRecipeIngredients,
  serializeRecipeIngredient,
} from "@/lib/recipe-ingredient";
import { useCanonicals } from "@/hooks/useCanonicals";
import { useAliases } from "@/hooks/useAliases";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RecipeMethodDisplay } from "@/components/RecipeMethodDisplay";
import { AddCanonicalToShoppingButton } from "@/components/AddCanonicalToShoppingButton";
import {
  IngredientResolutionEditor,
  type IngredientResolutionEditorHandle,
  type IngredientResolutionGate,
  type IngredientResolutionRow,
} from "@/components/IngredientResolutionEditor";
import { cap } from "@/lib/text";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RecipeTagBadges } from "@/components/RecipeTagBadges";
import { RecipeTagPicker } from "@/components/RecipeTagPicker";
import {
  getRecipeServes,
  isRecipesServesColumnError,
  stripRecipeMetaIngredient,
  withServesMetaIngredient,
} from "@/lib/recipe-serves-fallback";
import { parseRecipeTags, type RecipeTag } from "@/lib/recipe-tags";

export const Route = createFileRoute("/recipes/$id")({
  component: RecipeDetailPage,
});

type MealType = "breakfast" | "lunch" | "dinner";
const MEAL_TYPES: { key: MealType; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
];

function sourceHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Open link";
  }
}

function RecipeDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const { rows: pantry } = useTable<Ingredient>("ingredients");
  const { rows: shopping, refresh: refreshShopping } = useTable<ShoppingItem>("shopping_list");
  const { rows: planRows, refresh: refreshPlan } = useTable<MealPlanRow>("meal_plan");
  const { rows: canonicals, refresh: refreshCanonicals } = useCanonicals();
  const { refresh: refreshAliases } = useAliases();
  const [editing, setEditing] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [servesValue, setServesValue] = useState("");
  const [sourceUrlValue, setSourceUrlValue] = useState("");
  const [methodValue, setMethodValue] = useState("");
  const [tagsValue, setTagsValue] = useState<RecipeTag[]>([]);
  const [editRows, setEditRows] = useState<IngredientResolutionRow[]>([]);
  const ingredientEditorRef = useRef<IngredientResolutionEditorHandle>(null);
  const [resolutionGate, setResolutionGate] = useState<IngredientResolutionGate>({
    allMatched: false,
    aiLoading: false,
  });
  const onIngredientResolutionGate = useCallback((gate: IngredientResolutionGate) => {
    setResolutionGate(gate);
  }, []);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("recipes")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setRecipe(data as Recipe | null);
      });
  }, [id]);

  useEffect(() => {
    if (!recipe) return;
    setTitleValue(recipe.title ?? "");
    setServesValue(getRecipeServes(recipe) ?? "");
    setSourceUrlValue(recipe.source_url ?? "");
    setMethodValue(recipe.method ?? "");
    setTagsValue(parseRecipeTags(recipe.tags));
  }, [recipe]);

  if (!recipe) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  const beginEdit = () => {
    setResolutionGate({ allMatched: false, aiLoading: false });
    const current = stripRecipeMetaIngredient(
      (recipe.ingredients as RecipeIngredient[] | null) ?? [],
    );
    setEditRows(
      current.map((ingredient) => ({
        key: crypto.randomUUID(),
        ingredient,
      })),
    );
    setTitleValue(recipe.title ?? "");
    setServesValue(getRecipeServes(recipe) ?? "");
    setSourceUrlValue(recipe.source_url ?? "");
    setMethodValue(recipe.method ?? "");
    setTagsValue(parseRecipeTags(recipe.tags));
    setEditing(true);
  };

  const canonicalNameById = new Map(canonicals.map((c) => [c.id, c.name]));
  const pantryCanonicalIds = new Set(pantry.map((p) => p.canonical_id).filter(Boolean) as string[]);
  const shoppingCanonicalIds = new Set(
    shopping.map((s) => s.canonical_id).filter(Boolean) as string[],
  );
  const recipeServes = getRecipeServes(recipe);
  const recipeTags = parseRecipeTags(recipe.tags);
  const ingredients = stripRecipeMetaIngredient(
    (recipe.ingredients as RecipeIngredient[] | null) ?? [],
  );
  const { required: requiredIngredients, optional: optionalIngredients } =
    partitionRecipeIngredients(ingredients);
  const inPlanner = planRows.some((p) => p.recipe_id === recipe.id);
  const hasMethod = Boolean(recipe.method?.trim());

  const renderIngredientItem = (ing: RecipeIngredient, key: string) => {
    const ids = ingredientCanonicalIds(ing).sort((a, b) => {
      const aIn = pantryCanonicalIds.has(a);
      const bIn = pantryCanonicalIds.has(b);
      if (aIn === bIn) return 0;
      return aIn ? -1 : 1;
    });
    const line = formatOriginalIngredientLine(ing);
    const haveInPantry = ids.some((id) => pantryCanonicalIds.has(id));
    const haveOnShoppingList = !haveInPantry && ids.some((id) => shoppingCanonicalIds.has(id));
    return (
      <li key={key} className="flex flex-row items-start gap-2 rounded-lg px-2 py-1.5">
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
            haveInPantry
              ? "bg-success text-success-foreground"
              : haveOnShoppingList
                ? "bg-basket-solid text-basket-solid-foreground"
                : "border border-border bg-muted/40 text-muted-foreground",
          )}
          role="img"
          aria-label={
            haveInPantry
              ? "At least one linked library ingredient is in your pantry"
              : haveOnShoppingList
                ? "At least one linked library ingredient is on your shopping list"
                : ids.length
                  ? "None of the linked library ingredients are in your pantry or on your shopping list"
                  : "This line is not linked to your ingredients library"
          }
        >
          {haveInPantry ? (
            <Carrot className="h-3 w-3 shrink-0" />
          ) : haveOnShoppingList ? (
            <ShoppingBasket className="h-3 w-3" />
          ) : (
            <X className="h-3 w-3" />
          )}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="break-words text-sm font-medium leading-snug">{line}</p>
          {ids.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ids.map((id) => {
                const rawName = canonicalNameById.get(id);
                if (!rawName) return null;
                const inPantry = pantryCanonicalIds.has(id);
                const onShoppingList = !inPantry && shoppingCanonicalIds.has(id);
                return (
                  <span
                    key={id}
                    className={cn(
                      "inline-flex max-w-full items-center gap-0.5 rounded-full border py-0.5 pl-2.5 pr-1 text-xs font-medium",
                      inPantry
                        ? "border-success/40 bg-success/15 text-success"
                        : onShoppingList
                          ? "border-basket/40 bg-basket-subtle text-basket-foreground"
                          : "border-border bg-muted/40 text-muted-foreground",
                    )}
                  >
                    <span className="truncate">{cap(rawName)}</span>
                    <AddCanonicalToShoppingButton
                      canonicalId={id}
                      name={rawName}
                      shopping={shopping}
                      inPantry={inPantry}
                      onAdded={refreshShopping}
                    />
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </li>
    );
  };

  const addToPlanner = async (mealType: MealType) => {
    const { error } = await supabase
      .from("meal_plan")
      .insert({ recipe_id: recipe.id, meal_type: mealType });
    if (error) return toast.error(error.message);
    toast.success(`Added to ${mealType}`);
    refreshPlan();
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("recipes").delete().eq("id", recipe.id);
    if (error) {
      setDeleting(false);
      return toast.error(error.message);
    }
    toast.success("Recipe deleted");
    navigate({ to: "/recipes" });
  };

  const cancelEdit = () => {
    setResolutionGate({ allMatched: false, aiLoading: false });
    setTitleValue(recipe.title ?? "");
    setServesValue(getRecipeServes(recipe) ?? "");
    setSourceUrlValue(recipe.source_url ?? "");
    setMethodValue(recipe.method ?? "");
    setTagsValue(parseRecipeTags(recipe.tags));
    setEditRows([]);
    setEditing(false);
  };

  const saveEdit = async () => {
    const nextTitle = titleValue.trim();
    if (!nextTitle) return toast.error("Recipe title is required");

    setSaving(true);
    try {
      let nextIngredients: RecipeIngredient[];
      try {
        const finalized = await ingredientEditorRef.current?.finalize();
        if (!finalized) {
          toast.error("Could not save ingredients");
          return;
        }
        nextIngredients = finalized
          .map((ing) => serializeRecipeIngredient(ing))
          .filter((ing): ing is RecipeIngredient => ing !== null);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Could not save ingredients");
        return;
      }

      const serves = servesValue.trim() || null;
      const sourceUrl = sourceUrlValue.trim() || null;
      const ingredientsForSave = stripRecipeMetaIngredient(nextIngredients);
      const updatePayload = {
        title: nextTitle,
        serves,
        source_url: sourceUrl,
        method: methodValue,
        ingredients: ingredientsForSave as any,
        tags: tagsValue,
      };
      let { error: updateError } = await supabase
        .from("recipes")
        .update(updatePayload)
        .eq("id", recipe.id);

      let servesSavedInMeta = false;
      if (isRecipesServesColumnError(updateError)) {
        servesSavedInMeta = true;
        if (import.meta.env.DEV) {
          console.warn(
            "[recipes] `recipes.serves` not in PostgREST schema; storing serves in ingredients until migration is applied.",
          );
        }
        const { error: retryError } = await supabase
          .from("recipes")
          .update({
            title: nextTitle,
            source_url: sourceUrl,
            method: methodValue,
            ingredients: withServesMetaIngredient(ingredientsForSave, serves) as any,
            tags: tagsValue,
          })
          .eq("id", recipe.id);
        updateError = retryError;
      }

      if (updateError) {
        toast.error(updateError.message);
        return;
      }

      const { data: refreshed } = await supabase
        .from("recipes")
        .select("*")
        .eq("id", recipe.id)
        .maybeSingle();
      if (refreshed) {
        setRecipe(refreshed as Recipe);
      } else {
        setRecipe((prev) =>
          prev
            ? ({
                ...prev,
                title: nextTitle,
                serves: servesSavedInMeta ? null : serves,
                source_url: sourceUrl,
                method: methodValue,
                tags: tagsValue,
                ingredients: (servesSavedInMeta
                  ? withServesMetaIngredient(ingredientsForSave, serves)
                  : ingredientsForSave) as any,
              } as Recipe)
            : prev,
        );
      }
      setEditing(false);
      setEditRows([]);
      void Promise.all([refreshCanonicals(), refreshAliases()]);
      toast.success("Recipe updated");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        to="/recipes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to recipes
      </Link>

      <header
        className={cn(
          "flex flex-col gap-4",
          !editing && "sm:flex-row sm:items-end sm:justify-between",
        )}
      >
        {editing ? (
          <div className="w-full space-y-4">
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={saveEdit}
                disabled={saving || !resolutionGate.allMatched}
                title={
                  !resolutionGate.allMatched
                    ? "Map every ingredient to your library before saving."
                    : undefined
                }
                className="gap-1.5"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
            <div className="w-full space-y-2">
              <Input
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                className="w-full"
                placeholder="Recipe title"
                disabled={saving}
              />
              <Input
                value={servesValue}
                onChange={(e) => setServesValue(e.target.value)}
                className="w-full"
                placeholder="Serves (optional)"
                disabled={saving}
              />
              <Input
                type="url"
                value={sourceUrlValue}
                onChange={(e) => setSourceUrlValue(e.target.value)}
                className="w-full"
                placeholder="Source link (optional)"
                disabled={saving}
              />
              <RecipeTagPicker value={tagsValue} onChange={setTagsValue} disabled={saving} />
            </div>
          </div>
        ) : (
          <>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{recipe.title}</h1>
              {recipeServes && (
                <p className="mt-1 text-sm text-muted-foreground">Serves {recipeServes}</p>
              )}
              {recipe.source_url && (
                <div className="mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 px-2.5 text-xs font-normal"
                    asChild
                  >
                    <a href={recipe.source_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {sourceHostname(recipe.source_url)}
                    </a>
                  </Button>
                </div>
              )}
              <RecipeTagBadges tags={recipeTags} className="mt-3" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-1.5" onClick={beginEdit}>
                <Pencil className="h-4 w-4" /> Edit recipe
              </Button>
              {inPlanner ? (
                <Button className="gap-1.5" disabled title="Already in planner">
                  <CalendarCheck className="h-4 w-4" /> In planner
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="gap-1.5">
                      <Plus className="h-4 w-4" /> Add to planner
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Choose meal</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {MEAL_TYPES.map((m) => (
                      <DropdownMenuItem key={m.key} onSelect={() => void addToPlanner(m.key)}>
                        {m.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </>
        )}
      </header>

      <div className={cn(editing ? "space-y-0" : "space-y-6")}>
        <section
          className={cn(
            editing
              ? "border-t border-border pt-6"
              : "rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]",
          )}
        >
          <h2 className="mb-3 font-semibold">Ingredients</h2>
          {editing ? (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Edit each line as it appears in the recipe, then map it to your ingredients library
                (tags). Search below each line or add a new ingredient — same as when importing a
                recipe.
              </p>
              <IngredientResolutionEditor
                ref={ingredientEditorRef}
                rows={editRows}
                onRowsChange={setEditRows}
                allowAddRemove
                disabled={saving}
                onResolutionGateChange={onIngredientResolutionGate}
              />
            </div>
          ) : (
            <ul className="space-y-3">
              {requiredIngredients.map((ing, i) => renderIngredientItem(ing, `req-${i}`))}
              {optionalIngredients.length > 0 && (
                <>
                  {requiredIngredients.length > 0 && (
                    <li className="list-none px-2 py-2" aria-hidden>
                      <div className="border-t border-border" />
                    </li>
                  )}
                  <li className="list-none px-2 pb-1">
                    <h3 className="text-sm font-semibold">Optional ingredients</h3>
                  </li>
                  {optionalIngredients.map((ing, i) => renderIngredientItem(ing, `opt-${i}`))}
                </>
              )}
            </ul>
          )}
        </section>

        {(editing || hasMethod) && (
          <section
            className={cn(
              editing
                ? "border-t border-border pt-6"
                : "rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]",
            )}
          >
            <h2 className="mb-3 font-semibold">Method</h2>
            {editing ? (
              <Textarea
                value={methodValue}
                onChange={(e) => setMethodValue(e.target.value)}
                placeholder="Method..."
                rows={12}
                style={{ minHeight: 300 }}
                className="min-h-[300px] w-full resize-y bg-white py-3 leading-8"
                disabled={saving}
              />
            ) : (
              <RecipeMethodDisplay method={recipe.method ?? ""} />
            )}
          </section>
        )}

        {!editing && (
          <div className="flex justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" /> Delete recipe
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this recipe?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove &ldquo;{recipe.title}&rdquo;. This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </div>
  );
}
