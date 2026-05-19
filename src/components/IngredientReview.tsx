import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type RecipeIngredient } from "@/hooks/useTable";
import {
  IngredientResolutionEditor,
  type IngredientResolutionEditorHandle,
  type IngredientResolutionGate,
  type IngredientResolutionRow,
} from "@/components/IngredientResolutionEditor";
import { toast } from "sonner";

export type IngredientReviewResult = {
  ingredients: RecipeIngredient[];
  title: string;
  serves: string;
  sourceUrl: string;
  method: string;
};

export type IngredientReviewProps = {
  ingredients: RecipeIngredient[];
  initialTitle?: string;
  initialServes?: string;
  initialSourceUrl?: string;
  /** Initial method / instructions (e.g. from AI import); user can edit before save. */
  initialMethod?: string;
  onCancel: () => void;
  onConfirm: (result: IngredientReviewResult) => Promise<void> | void;
};

/** @deprecated import from `@/lib/ingredient-match` */
export { AI_PANTRY_CONFIDENCE_THRESHOLD } from "@/lib/ingredient-match";

export function IngredientReview({
  ingredients,
  initialTitle = "",
  initialServes = "",
  initialSourceUrl = "",
  initialMethod = "",
  onCancel,
  onConfirm,
}: IngredientReviewProps) {
  const editorRef = useRef<IngredientResolutionEditorHandle>(null);
  const [titleDraft, setTitleDraft] = useState(initialTitle);
  const [servesDraft, setServesDraft] = useState(initialServes);
  const [sourceUrlDraft, setSourceUrlDraft] = useState(initialSourceUrl);
  const [methodDraft, setMethodDraft] = useState(initialMethod);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitleDraft(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    setServesDraft(initialServes);
  }, [initialServes]);

  useEffect(() => {
    setSourceUrlDraft(initialSourceUrl);
  }, [initialSourceUrl]);

  useEffect(() => {
    setMethodDraft(initialMethod);
  }, [initialMethod]);

  const [rows, setRows] = useState<IngredientResolutionRow[]>([]);
  const [resolutionGate, setResolutionGate] = useState<IngredientResolutionGate>({
    allMatched: false,
    aiLoading: false,
  });

  const onResolutionGateChange = useCallback((gate: IngredientResolutionGate) => {
    setResolutionGate(gate);
  }, []);

  useEffect(() => {
    setResolutionGate({ allMatched: false, aiLoading: false });
    setRows(
      ingredients.map((ingredient) => ({
        key: crypto.randomUUID(),
        ingredient,
      })),
    );
  }, [ingredients]);

  const canSaveRecipe = resolutionGate.allMatched && !resolutionGate.aiLoading && rows.length > 0;

  const save = async () => {
    const title = titleDraft.trim();
    if (!title) {
      toast.error("Recipe title is required");
      return;
    }

    setSaving(true);
    try {
      const finalIngredients = await editorRef.current?.finalize();
      if (!finalIngredients) return;
      await onConfirm({
        ingredients: finalIngredients,
        title,
        serves: servesDraft.trim(),
        sourceUrl: sourceUrlDraft.trim(),
        method: methodDraft,
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 pb-1 pt-12 sm:gap-6 sm:pt-14">
      <div className="min-w-0 space-y-4">
        <p className="text-base font-semibold leading-snug tracking-tight sm:text-lg sm:font-semibold">
          Review recipe
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Check the title and details, then map each ingredient to your library. Click any
          ingredient line to edit it. When cups or ounces were converted to metric, you will see the
          original and converted wording side by side.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Back
        </Button>
        <Button
          type="button"
          onClick={save}
          disabled={saving || !canSaveRecipe}
          title={
            !canSaveRecipe
              ? resolutionGate.aiLoading
                ? "Matching ingredients…"
                : "Map every ingredient to your library before saving."
              : undefined
          }
          className="gap-1.5"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving...
            </>
          ) : (
            "Save recipe"
          )}
        </Button>
      </div>

      <div className="min-w-0 w-full space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="review-recipe-title" className="text-sm font-medium">
            Title
          </Label>
          <Input
            id="review-recipe-title"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            placeholder="Recipe title"
            className="w-full bg-white"
            disabled={saving}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="review-recipe-serves" className="text-sm font-medium">
            Serves
          </Label>
          <Input
            id="review-recipe-serves"
            value={servesDraft}
            onChange={(e) => setServesDraft(e.target.value)}
            placeholder="e.g. 4"
            className="w-full bg-white"
            disabled={saving}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="review-recipe-source" className="text-sm font-medium">
            Source link
          </Label>
          <Input
            id="review-recipe-source"
            type="url"
            value={sourceUrlDraft}
            onChange={(e) => setSourceUrlDraft(e.target.value)}
            placeholder="https://…"
            className="w-full bg-white"
            disabled={saving}
          />
        </div>
      </div>

      <section className="border-t border-border pt-6">
        <h2 className="mb-3 text-sm font-semibold">Ingredients</h2>
        <IngredientResolutionEditor
          ref={editorRef}
          rows={rows}
          onRowsChange={setRows}
          autoSuggestAi
          allowAddRemove={false}
          disabled={saving}
          onResolutionGateChange={onResolutionGateChange}
        />
      </section>

      <section className="min-w-0 space-y-2 border-t border-border pt-6">
        <p className="text-sm font-medium">Method / instructions</p>
        <p className="text-xs text-muted-foreground">
          Edit the steps here if anything looks wrong before you save.
        </p>
        <Textarea
          value={methodDraft}
          onChange={(e) => setMethodDraft(e.target.value)}
          rows={12}
          className="min-h-[220px] w-full min-w-0 max-w-full resize-y bg-white sm:min-h-[280px]"
          placeholder="Describe how to cook the dish…"
          disabled={saving}
        />
      </section>

    </div>
  );
}
