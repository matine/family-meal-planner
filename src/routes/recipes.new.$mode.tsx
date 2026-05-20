import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Sparkles,
  Type,
} from "lucide-react";
import { RecipeFormEditor } from "@/components/RecipeFormEditor";
import { RecipePageActions } from "@/components/RecipeStickyToolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { RecipeIngredient } from "@/hooks/useTable";
import { setRecipeImportDraft } from "@/lib/recipe-import-draft";
import { parseRecipe } from "@/lib/recipesFunctions";
import { saveRecipe } from "@/lib/save-recipe";
import { toast } from "sonner";

const RECIPE_NEW_MODES = ["manual", "url", "photo", "text"] as const;
type RecipeNewMode = (typeof RECIPE_NEW_MODES)[number];

function isRecipeNewMode(value: string): value is RecipeNewMode {
  return (RECIPE_NEW_MODES as readonly string[]).includes(value);
}

const MODE_META: Record<
  RecipeNewMode,
  { label: string; pageTitle: string; captureTitle: string }
> = {
  manual: {
    label: "Manual",
    pageTitle: "Add recipe",
    captureTitle: "Add recipe",
  },
  url: {
    label: "From URL",
    pageTitle: "Import from URL",
    captureTitle: "Import from URL",
  },
  photo: {
    label: "From photo",
    pageTitle: "Import from photo",
    captureTitle: "Import from photo",
  },
  text: {
    label: "Paste text",
    pageTitle: "Import from text",
    captureTitle: "Import from text",
  },
};

export const Route = createFileRoute("/recipes/new/$mode")({
  beforeLoad: ({ params }) => {
    if (!isRecipeNewMode(params.mode)) {
      throw redirect({ to: "/recipes" });
    }
  },
  component: RecipeNewModePage,
  head: ({ params }) => ({
    meta: [{ title: `${MODE_META[params.mode as RecipeNewMode].pageTitle} — Family Kitchen` }],
  }),
});

function RecipeNewModePage() {
  const { mode } = Route.useParams();
  const navigate = useNavigate();

  if (mode === "manual") {
    return (
      <RecipeFormEditor
        pageTitle="Add recipe"
        initialIngredients={[{ name: "" }]}
        onCancel={() => navigate({ to: "/recipes" })}
        onSave={async (data) => {
          const id = await saveRecipe(data);
          toast.success("Recipe saved");
          navigate({ to: "/recipes/$id", params: { id } });
        }}
      />
    );
  }

  if (mode === "url") {
    return (
      <ImportCapturePage
        title={MODE_META.url.captureTitle}
        onCancel={() => navigate({ to: "/recipes" })}
        onSubmit={async (payload) => {
          const parsed = await parseRecipe({ data: { mode: "url", payload } });
          setRecipeImportDraft(parsed);
          navigate({ to: "/recipes/new/review" });
        }}
      >
        {(value, setValue, disabled) => (
          <Input
            placeholder="https://example.com/recipe or Instagram URL"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={disabled}
          />
        )}
      </ImportCapturePage>
    );
  }

  if (mode === "text") {
    return (
      <ImportCapturePage
        title={MODE_META.text.captureTitle}
        onCancel={() => navigate({ to: "/recipes" })}
        onSubmit={async (payload) => {
          const parsed = await parseRecipe({ data: { mode: "text", payload } });
          setRecipeImportDraft(parsed);
          navigate({ to: "/recipes/new/review" });
        }}
      >
        {(value, setValue, disabled) => (
          <Textarea
            placeholder="Paste recipe text here..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={8}
            disabled={disabled}
          />
        )}
      </ImportCapturePage>
    );
  }

  return (
    <PhotoCapturePage
      onCancel={() => navigate({ to: "/recipes" })}
      onParsed={(parsed) => {
        setRecipeImportDraft(parsed);
        navigate({ to: "/recipes/new/review" });
      }}
    />
  );
}

function ImportCapturePage({
  title,
  onCancel,
  onSubmit,
  children,
}: {
  title: string;
  onCancel: () => void;
  onSubmit: (payload: string) => Promise<void>;
  children: (
    value: string,
    setValue: (v: string) => void,
    disabled: boolean,
  ) => React.ReactNode;
}) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    try {
      await onSubmit(value.trim());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <RecipePageActions
        backLink={
          <Link
            to="/recipes"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to recipes
          </Link>
        }
      />
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;ll extract the recipe with AI, then you can review ingredients and details before
          saving.
        </p>
      </header>
      <form onSubmit={submit} className="max-w-xl space-y-4">
        {children(value, setValue, loading)}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !value.trim()} className="gap-1.5">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Importing…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Continue to review
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Amounts and oven temperatures are converted to UK metric (g, ml, °C) where possible.
        </p>
      </form>
    </div>
  );
}

function PhotoCapturePage({
  onCancel,
  onParsed,
}: {
  onCancel: () => void;
  onParsed: (parsed: import("@/lib/recipes.functions").ParseRecipeResponse) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      onParsed(parsed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <RecipePageActions
        backLink={
          <Link
            to="/recipes"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to recipes
          </Link>
        }
      />
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Import from photo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload a cookbook page, then review the extracted recipe before saving.
        </p>
      </header>
      <div className="max-w-xl space-y-4">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 hover:bg-muted">
          {preview ? (
            <img src={preview} alt="Recipe preview" className="max-h-64 rounded-lg" />
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
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!preview || loading}
            className="gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Reading recipe…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Continue to review
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
