import { useRef, useState } from "react";
import { ImageIcon, Link2, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecipeFormField } from "@/components/RecipeFormField";
import { fetchRecipeImageFromSource } from "@/lib/recipesFunctions";
import { isAllowedRecipeImageFile, uploadRecipeImage } from "@/lib/recipe-image";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function RecipeImageField({
  value,
  onChange,
  sourceUrl,
  recipeId,
  disabled,
}: {
  value: string;
  onChange: (url: string) => void;
  sourceUrl?: string;
  recipeId?: string;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const previewUrl = value.trim() || null;
  const hasSourceLink = Boolean(sourceUrl?.trim());
  const busy = uploading || generating;

  const onFile = async (file: File) => {
    if (!isAllowedRecipeImageFile(file)) {
      toast.error("Use a JPEG, PNG, WebP, or GIF under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const publicUrl = await uploadRecipeImage(file, recipeId);
      onChange(publicUrl);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const generateFromSource = async () => {
    const link = sourceUrl?.trim();
    if (!link) return;
    setGenerating(true);
    try {
      const { image_url } = await fetchRecipeImageFromSource({ data: { sourceUrl: link } });
      onChange(image_url);
      toast.success("Image loaded from source link");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load image");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <RecipeFormField label="Image">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={cn(
            "relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40",
            !previewUrl && "border-dashed",
          )}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" aria-hidden />
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={disabled || busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={disabled || busy}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Upload image
          </Button>
          {hasSourceLink && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={disabled || busy}
              onClick={() => void generateFromSource()}
            >
              <Link2 className="h-4 w-4" />
              Generate from source link
            </Button>
          )}
          {previewUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={disabled || busy}
              onClick={() => onChange("")}
            >
              <X className="h-4 w-4" />
              Remove
            </Button>
          )}
        </div>
      </div>
    </RecipeFormField>
  );
}
