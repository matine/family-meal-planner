import { useCallback, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { RecipeDetailsFields } from "@/components/RecipeDetailsFields";
import { RecipeFormField } from "@/components/RecipeFormField";
import { RecipePageActions, RecipeStickyToolbar } from "@/components/RecipeStickyToolbar";
import {
  IngredientResolutionEditor,
  type IngredientResolutionEditorHandle,
  type IngredientResolutionGate,
  type IngredientResolutionRow,
} from "@/components/IngredientResolutionEditor";
import { Textarea } from "@/components/ui/textarea";
import type { RecipeIngredient } from "@/hooks/useTable";
import type { RecipeMealType } from "@/lib/recipe-meal-types";
import type { SaveRecipeInput } from "@/lib/save-recipe";
import type { RecipeTag } from "@/lib/recipe-tags";
import { toast } from "sonner";

function ingredientsToRows(ingredients: RecipeIngredient[]): IngredientResolutionRow[] {
  return ingredients.map((ingredient) => ({
    key: crypto.randomUUID(),
    ingredient,
  }));
}

export function RecipeFormEditor({
  pageTitle,
  backLabel = "Back to recipes",
  ingredientsHint = "Edit each line as it appears in the recipe, then map it to your ingredients library. Search below each line or add a new ingredient — same as when importing a recipe.",
  initialTitle = "",
  initialServes = "",
  initialSourceUrl = "",
  initialMethod = "",
  initialTags = [],
  initialCookTimeMinutes = null,
  initialMealTypes = [],
  initialIngredients,
  ingredientAutoSuggest = false,
  allowAddRemoveIngredients = true,
  onSave,
  onCancel,
}: {
  pageTitle: string;
  backLabel?: string;
  ingredientsHint?: string;
  initialTitle?: string;
  initialServes?: string;
  initialSourceUrl?: string;
  initialMethod?: string;
  initialTags?: RecipeTag[];
  initialCookTimeMinutes?: number | null;
  initialMealTypes?: RecipeMealType[];
  initialIngredients: RecipeIngredient[];
  ingredientAutoSuggest?: boolean;
  allowAddRemoveIngredients?: boolean;
  onSave: (data: SaveRecipeInput) => Promise<void>;
  onCancel: () => void;
}) {
  const editorRef = useRef<IngredientResolutionEditorHandle>(null);
  const [title, setTitle] = useState(initialTitle);
  const [serves, setServes] = useState(initialServes);
  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl);
  const [method, setMethod] = useState(initialMethod);
  const [tags, setTags] = useState<RecipeTag[]>(initialTags);
  const [cookTimeMinutes, setCookTimeMinutes] = useState<number | null>(initialCookTimeMinutes);
  const [mealTypes, setMealTypes] = useState<RecipeMealType[]>(initialMealTypes);
  const [editRows, setEditRows] = useState<IngredientResolutionRow[]>(() =>
    ingredientsToRows(initialIngredients),
  );
  const [saving, setSaving] = useState(false);
  const [resolutionGate, setResolutionGate] = useState<IngredientResolutionGate>({
    allMatched: false,
    aiLoading: false,
  });

  const onResolutionGateChange = useCallback((gate: IngredientResolutionGate) => {
    setResolutionGate(gate);
  }, []);

  const canSave =
    resolutionGate.allMatched && !resolutionGate.aiLoading && editRows.length > 0;

  const handleSave = async () => {
    const nextTitle = title.trim();
    if (!nextTitle) {
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
      await onSave({
        title: nextTitle,
        serves: serves.trim() || undefined,
        source_url: sourceUrl.trim() || undefined,
        method,
        ingredients: finalized,
        tags,
        cook_time_minutes: cookTimeMinutes,
        meal_types: mealTypes,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save recipe");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <RecipePageActions
        backLink={
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" /> {backLabel}
          </button>
        }
        toolbar={
          <RecipeStickyToolbar
            active
            onCancel={onCancel}
            onSave={handleSave}
            saving={saving}
            saveDisabled={!canSave}
            saveDisabledTitle={
              resolutionGate.aiLoading
                ? "Matching ingredients…"
                : "Map every ingredient to your library before saving."
            }
            cancelLabel="Cancel"
            saveLabel="Save recipe"
          />
        }
      />

      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{pageTitle}</h1>
        <RecipeDetailsFields
          title={title}
          onTitleChange={setTitle}
          serves={serves}
          onServesChange={setServes}
          sourceUrl={sourceUrl}
          onSourceUrlChange={setSourceUrl}
          cookTimeMinutes={cookTimeMinutes}
          onCookTimeChange={setCookTimeMinutes}
          mealTypes={mealTypes}
          onMealTypesChange={setMealTypes}
          tags={tags}
          onTagsChange={setTags}
          disabled={saving}
          titleRequired
        />
      </header>

      <div className="space-y-0">
        <section className="border-t border-border pt-6">
          <RecipeFormField label="Ingredients">
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-muted-foreground">{ingredientsHint}</p>
              <IngredientResolutionEditor
                ref={editorRef}
                rows={editRows}
                onRowsChange={setEditRows}
                autoSuggestAi={ingredientAutoSuggest}
                allowAddRemove={allowAddRemoveIngredients}
                disabled={saving}
                onResolutionGateChange={onResolutionGateChange}
              />
            </div>
          </RecipeFormField>
        </section>

        <section className="border-t border-border pt-6">
          <RecipeFormField label="Method">
            <Textarea
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="Use numbered steps to describe how to cook the recipe..."
              rows={12}
              className="min-h-[300px] w-full resize-y py-3 leading-8"
              disabled={saving}
            />
          </RecipeFormField>
        </section>
      </div>

      {saving && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Saving recipe…
        </p>
      )}
    </div>
  );
}
