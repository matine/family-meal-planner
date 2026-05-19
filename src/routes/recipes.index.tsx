import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import {
  BookOpen,
  CalendarCheck,
  CalendarPlus,
  Carrot,
  Plus,
  Trash2,
  Sparkles,
  Link as LinkIcon,
  Image as ImageIcon,
  Type,
  X,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  useTable,
  type Ingredient,
  type MealPlanRow,
  type Recipe,
  type RecipeIngredient,
} from "@/hooks/useTable";
import { ingredientCanonicalIds, isOptionalIngredient } from "@/lib/recipe-ingredient";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { parseRecipe } from "@/lib/recipesFunctions";
import { IngredientReview } from "@/components/IngredientReview";
import {
  IngredientResolutionEditor,
  type IngredientResolutionEditorHandle,
  type IngredientResolutionGate,
  type IngredientResolutionRow,
} from "@/components/IngredientResolutionEditor";
import {
  getRecipeServes,
  isRecipesServesColumnError,
  stripRecipeMetaIngredient,
  withServesMetaIngredient,
} from "@/lib/recipe-serves-fallback";

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

function RecipesPage() {
  const { rows: recipes, refresh } = useTable<Recipe>("recipes");
  const { rows: planRows, refresh: refreshPlan } = useTable<MealPlanRow>("meal_plan");
  const { rows: pantry } = useTable<Ingredient>("ingredients");
  const [open, setOpen] = useState(false);

  // Quick lookup of which recipes are already in the planner (any meal type).
  const plannedRecipeIds = new Set(
    planRows.map((p) => p.recipe_id).filter((id): id is string => !!id),
  );

  // Set of canonical ingredient ids the user has in their pantry, used to
  // compute "have X of Y" per recipe (same matching rule as the detail page).
  const pantryCanonicalIds = new Set(
    pantry.map((p) => p.canonical_id).filter((id): id is string => !!id),
  );

  const handleSaved = () => {
    refresh();
    setOpen(false);
  };

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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" /> Add recipe
            </Button>
          </DialogTrigger>
          <AddRecipeDialog onClose={handleSaved} />
        </Dialog>
      </header>

      {recipes.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-[var(--gradient-warm)] p-10 text-center">
          <BookOpen className="mx-auto mb-3 h-10 w-10 text-primary" />
          <p className="font-medium">No recipes yet</p>
          <p className="text-sm text-muted-foreground">
            Snap a cookbook page, paste a link, or type one in.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {recipes.map((r) => {
            const inPlanner = plannedRecipeIds.has(r.id);
            const recipeServes = getRecipeServes(r);
            const recipeIngs = stripRecipeMetaIngredient(
              (r.ingredients as RecipeIngredient[] | null) ?? [],
            );
            const requiredIngs = recipeIngs.filter((i) => !isOptionalIngredient(i));
            const totalIngs = requiredIngs.length;
            const haveIngs = requiredIngs.filter((i) =>
              ingredientCanonicalIds(i).some((id) => pantryCanonicalIds.has(id)),
            ).length;
            const haveAll = totalIngs > 0 && haveIngs === totalIngs;
            return (
              <Link
                key={r.id}
                to="/recipes/$id"
                params={{ id: r.id }}
                className="relative rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] transition hover:border-primary/40 hover:shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-start gap-3">
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
                  <div className="min-w-0 flex-1 pr-8">
                    <h3 className="truncate font-semibold">{r.title}</h3>
                    {recipeServes && (
                      <p className="text-xs text-muted-foreground">Serves {recipeServes}</p>
                    )}
                    {recipeIngs.length === 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">No ingredients</p>
                    ) : (
                      totalIngs > 0 && (
                        <span
                          className={cn(
                            "mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums",
                            haveAll
                              ? "border-success/40 bg-success/15 text-success"
                              : "border-border bg-muted/60 text-muted-foreground",
                          )}
                          title={`${haveIngs} of ${totalIngs} required ingredients in pantry`}
                        >
                          <Carrot className="h-3 w-3 shrink-0" aria-hidden />
                          {haveIngs}/{totalIngs}
                          <span className="sr-only"> in pantry</span>
                        </span>
                      )
                    )}
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

function AddRecipeDialog({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState("manual");
  return (
    <DialogContent className="flex max-h-[min(92dvh,880px)] w-[calc(100vw-1.25rem)] max-w-[min(100vw-1.25rem,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[min(90vh,900px)] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl">
      <div className="shrink-0 border-b px-4 pb-3 pt-10 sm:px-6 sm:pt-6">
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle>Add a recipe</DialogTitle>
        </DialogHeader>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:pb-6">
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <TabsList className="grid w-full min-w-0 grid-cols-2 gap-1 sm:grid-cols-4 sm:gap-0">
            <TabsTrigger value="manual">
              <Type className="mr-1.5 h-3.5 w-3.5" />
              Manual
            </TabsTrigger>
            <TabsTrigger value="url">
              <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
              URL
            </TabsTrigger>
            <TabsTrigger value="photo">
              <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
              Photo
            </TabsTrigger>
            <TabsTrigger value="text">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Paste
            </TabsTrigger>
          </TabsList>
          <TabsContent value="manual">
            <ManualForm onDone={onClose} />
          </TabsContent>
          <TabsContent value="url">
            <AIForm
              mode="url"
              placeholder="https://example.com/recipe or Instagram URL"
              onDone={onClose}
            />
          </TabsContent>
          <TabsContent value="photo">
            <PhotoForm onDone={onClose} />
          </TabsContent>
          <TabsContent value="text">
            <AIForm
              mode="text"
              placeholder="Paste recipe text here..."
              onDone={onClose}
              multiline
            />
          </TabsContent>
        </Tabs>
      </div>
    </DialogContent>
  );
}

async function saveRecipe(r: {
  title: string;
  ingredients: RecipeIngredient[];
  method: string;
  serves?: string;
  source_url?: string;
  image_url?: string;
}) {
  const serves = r.serves?.trim() || null;
  const ingredients = stripRecipeMetaIngredient(r.ingredients);
  const insertPayload = {
    title: r.title,
    ingredients: ingredients as any,
    method: r.method,
    serves,
    source_url: r.source_url ?? null,
    image_url: r.image_url ?? null,
  };
  const { error } = await supabase.from("recipes").insert(insertPayload);
  if (isRecipesServesColumnError(error)) {
    if (import.meta.env.DEV) {
      console.warn(
        "[recipes] `recipes.serves` not in PostgREST schema; storing serves in ingredients until migration is applied.",
      );
    }
    const { error: retryError } = await supabase.from("recipes").insert({
      title: r.title,
      ingredients: withServesMetaIngredient(ingredients, serves) as any,
      method: r.method,
      source_url: r.source_url ?? null,
      image_url: r.image_url ?? null,
    });
    if (retryError) throw new Error(retryError.message);
    return;
  }
  if (error) throw new Error(error.message);
}

type Pending = import("@/lib/recipesFunctions").ParseRecipeResponse;

function ManualForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [serves, setServes] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [method, setMethod] = useState("");
  const [editRows, setEditRows] = useState<IngredientResolutionRow[]>(() => [
    { key: crypto.randomUUID(), ingredient: { name: "" } },
  ]);
  const editorRef = useRef<IngredientResolutionEditorHandle>(null);
  const [saving, setSaving] = useState(false);
  const [resolutionGate, setResolutionGate] = useState<IngredientResolutionGate>({
    allMatched: false,
    aiLoading: false,
  });
  const onResolutionGateChange = useCallback((gate: IngredientResolutionGate) => {
    setResolutionGate(gate);
  }, []);

  const canSubmitIngredients =
    resolutionGate.allMatched && !resolutionGate.aiLoading && editRows.length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Recipe title is required");
      return;
    }

    setSaving(true);
    try {
      const finalized = await editorRef.current?.finalize();
      if (!finalized?.length) {
        toast.error("Could not save ingredients");
        return;
      }
      await saveRecipe({
        title: title.trim(),
        serves: serves.trim() || undefined,
        source_url: sourceUrl.trim() || undefined,
        method,
        ingredients: finalized,
      });
      toast.success("Recipe saved");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save recipe");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 pt-2">
      <Input
        placeholder="Recipe title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        disabled={saving}
      />
      <Input
        placeholder="Serves (optional)"
        value={serves}
        onChange={(e) => setServes(e.target.value)}
        disabled={saving}
      />
      <Input
        type="url"
        placeholder="Source link (optional)"
        value={sourceUrl}
        onChange={(e) => setSourceUrl(e.target.value)}
        disabled={saving}
      />
      <div className="space-y-2">
        <p className="text-sm font-medium">Ingredients</p>
        <IngredientResolutionEditor
          ref={editorRef}
          rows={editRows}
          onRowsChange={setEditRows}
          allowAddRemove
          disabled={saving}
          onResolutionGateChange={onResolutionGateChange}
        />
      </div>
      <p className="text-sm font-medium">Method</p>
      <Textarea
        placeholder="Use numbered steps to describe how to cook the recipe..."
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        rows={6}
        disabled={saving}
      />
      <Button
        type="submit"
        className="w-full"
        disabled={saving || !canSubmitIngredients}
        title={
          !canSubmitIngredients ? "Map every ingredient to your library before saving." : undefined
        }
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
          </>
        ) : (
          "Save recipe"
        )}
      </Button>
    </form>
  );
}

function AIForm({
  mode,
  placeholder,
  multiline,
  onDone,
}: {
  mode: "url" | "text";
  placeholder: string;
  multiline?: boolean;
  onDone: () => void;
}) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    try {
      const parsed = await parseRecipe({ data: { mode, payload: value.trim() } });
      setPending(parsed);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to import");
    } finally {
      setLoading(false);
    }
  };

  if (pending) {
    return (
      <IngredientReview
        ingredients={pending.ingredients}
        initialTitle={pending.title}
        initialServes={pending.serves ?? ""}
        initialSourceUrl={pending.source_url ?? ""}
        initialMethod={pending.method}
        onCancel={() => setPending(null)}
        onConfirm={async ({ ingredients, title, serves, sourceUrl, method }) => {
          await saveRecipe({
            ...pending,
            title,
            serves: serves || undefined,
            source_url: sourceUrl || undefined,
            ingredients,
            method,
          });
          toast.success(`Saved "${title}"`);
          onDone();
        }}
      />
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 pt-2">
      {multiline ? (
        <Textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={8}
        />
      ) : (
        <Input placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} />
      )}
      <Button type="submit" disabled={loading} className="w-full gap-1.5">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Importing with AI...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" /> Import with AI
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground">
        Recipe import uses AI. Amounts and oven temperatures are converted to UK metric (g, ml, °C)
        where possible. You&apos;ll review ingredients against your pantry next.
      </p>
    </form>
  );
}

function PhotoForm({ onDone }: { onDone: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const onFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const submit = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const parsed = await parseRecipe({ data: { mode: "image", payload: preview } });
      setPending(parsed);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to import");
    } finally {
      setLoading(false);
    }
  };

  if (pending) {
    return (
      <IngredientReview
        ingredients={pending.ingredients}
        initialTitle={pending.title}
        initialServes={pending.serves ?? ""}
        initialSourceUrl={pending.source_url ?? ""}
        initialMethod={pending.method}
        onCancel={() => setPending(null)}
        onConfirm={async ({ ingredients, title, serves, sourceUrl, method }) => {
          await saveRecipe({
            ...pending,
            title,
            serves: serves || undefined,
            source_url: sourceUrl || undefined,
            ingredients,
            method,
          });
          toast.success(`Saved "${title}"`);
          onDone();
        }}
      />
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 hover:bg-muted">
        {preview ? (
          <img src={preview} alt="preview" className="max-h-64 rounded-lg" />
        ) : (
          <>
            <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Upload a cookbook photo</p>
            <p className="text-xs text-muted-foreground">JPG or PNG</p>
          </>
        )}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </label>
      <Button onClick={submit} disabled={!preview || loading} className="w-full gap-1.5">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Reading recipe...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" /> Extract recipe
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground">
        Amounts and oven temperatures are converted to UK metric (g, ml, °C) where possible.
      </p>
    </div>
  );
}
