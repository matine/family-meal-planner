import { RecipeImageField } from "@/components/RecipeImageField";
import { RecipeCookTimeField } from "@/components/RecipeCookTimeField";
import { RecipeFormField } from "@/components/RecipeFormField";
import { RecipeMealTypesPicker } from "@/components/RecipeMealTypesPicker";
import { RecipeTagPicker } from "@/components/RecipeTagPicker";
import { Input } from "@/components/ui/input";
import type { RecipeMealType } from "@/lib/recipe-meal-types";
import type { RecipeTag } from "@/lib/recipe-tags";
import { recipeFieldInvalidClass } from "@/lib/recipe-form-validation";
import { cn } from "@/lib/utils";

export function RecipeDetailsFields({
  title,
  onTitleChange,
  serves,
  onServesChange,
  sourceUrl,
  onSourceUrlChange,
  cookTimeMinutes,
  onCookTimeChange,
  mealTypes,
  onMealTypesChange,
  tags,
  onTagsChange,
  imageUrl,
  onImageUrlChange,
  recipeId,
  disabled,
  titleRequired,
  titleInvalid,
  className,
}: {
  title: string;
  onTitleChange: (value: string) => void;
  serves: string;
  onServesChange: (value: string) => void;
  sourceUrl: string;
  onSourceUrlChange: (value: string) => void;
  cookTimeMinutes: number | null;
  onCookTimeChange: (value: number | null) => void;
  mealTypes: RecipeMealType[];
  onMealTypesChange: (value: RecipeMealType[]) => void;
  tags: RecipeTag[];
  onTagsChange: (value: RecipeTag[]) => void;
  imageUrl: string;
  onImageUrlChange: (value: string) => void;
  recipeId?: string;
  disabled?: boolean;
  titleRequired?: boolean;
  titleInvalid?: boolean;
  className?: string;
}) {
  const showTitleError = Boolean(titleRequired && titleInvalid);

  return (
    <div className={cn("space-y-4", className)}>
      <RecipeFormField label="Title" required={titleRequired}>
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className={cn("w-full", showTitleError && recipeFieldInvalidClass)}
          placeholder="e.g. Chicken pie"
          required={titleRequired}
          disabled={disabled}
          aria-invalid={showTitleError || undefined}
        />
      </RecipeFormField>

      <RecipeFormField label="Source link">
        <Input
          type="url"
          value={sourceUrl}
          onChange={(e) => onSourceUrlChange(e.target.value)}
          className="w-full"
          placeholder="https://..."
          disabled={disabled}
        />
      </RecipeFormField>

      <RecipeImageField
        value={imageUrl}
        onChange={onImageUrlChange}
        sourceUrl={sourceUrl}
        recipeId={recipeId}
        disabled={disabled}
      />

      <RecipeFormField label="Serves">
        <Input
          value={serves}
          onChange={(e) => onServesChange(e.target.value)}
          className="w-full"
          placeholder="e.g. 4"
          disabled={disabled}
        />
      </RecipeFormField>

      <RecipeFormField label="Cook time (min)">
        <RecipeCookTimeField
          value={cookTimeMinutes}
          onChange={onCookTimeChange}
          disabled={disabled}
        />
      </RecipeFormField>

      <RecipeFormField label="Meal type">
        <RecipeMealTypesPicker
          value={mealTypes}
          onChange={onMealTypesChange}
          disabled={disabled}
        />
      </RecipeFormField>

      <RecipeFormField label="Tags">
        <RecipeTagPicker value={tags} onChange={onTagsChange} disabled={disabled} />
      </RecipeFormField>
    </div>
  );
}
