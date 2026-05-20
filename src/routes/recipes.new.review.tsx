import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { RecipeFormEditor } from "@/components/RecipeFormEditor";
import {
  clearRecipeImportDraft,
  getRecipeImportDraft,
} from "@/lib/recipe-import-draft";
import { saveRecipe } from "@/lib/save-recipe";
import { toast } from "sonner";

export const Route = createFileRoute("/recipes/new/review")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !getRecipeImportDraft()) {
      throw redirect({ to: "/recipes" });
    }
  },
  component: RecipeNewReviewPage,
  head: () => ({
    meta: [{ title: "Review recipe — Family Kitchen" }],
  }),
});

function RecipeNewReviewPage() {
  const navigate = useNavigate();
  const draft = getRecipeImportDraft();
  if (!draft) {
    throw redirect({ to: "/recipes" });
  }

  return (
    <RecipeFormEditor
      pageTitle="Review recipe"
      backLabel="Back to recipes"
      ingredientsHint="Check each ingredient line, then map it to your library. Click any line to edit it. When cups or ounces were converted to metric, you'll see the original and converted wording side by side."
      initialTitle={draft.title}
      initialServes={draft.serves ?? ""}
      initialSourceUrl={draft.source_url ?? ""}
      initialMethod={draft.method ?? ""}
      initialIngredients={draft.ingredients}
      ingredientAutoSuggest
      allowAddRemoveIngredients={false}
      onCancel={() => {
        clearRecipeImportDraft();
        navigate({ to: "/recipes" });
      }}
      onSave={async (data) => {
        const id = await saveRecipe({
          ...data,
          image_url: draft.image_url,
        });
        clearRecipeImportDraft();
        toast.success(`Saved "${data.title}"`);
        navigate({ to: "/recipes/$id", params: { id } });
      }}
    />
  );
}
