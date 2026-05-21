import { supabase } from "@/integrations/supabase/client";

export const RECIPE_IMAGES_BUCKET = "recipe-images";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 5 * 1024 * 1024;

function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}

export function isAllowedRecipeImageFile(file: File): boolean {
  return ALLOWED_TYPES.has(file.type) && file.size <= MAX_BYTES;
}

/** Upload a recipe cover image; returns a public URL stored in `recipes.image_url`. */
export async function uploadRecipeImage(file: File, recipeId?: string): Promise<string> {
  if (!isAllowedRecipeImageFile(file)) {
    throw new Error("Use a JPEG, PNG, WebP, or GIF under 5 MB.");
  }
  const folder = recipeId?.trim() || "new";
  const path = `${folder}/${crypto.randomUUID()}.${extensionForMime(file.type)}`;
  const { error } = await supabase.storage.from(RECIPE_IMAGES_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(RECIPE_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function normalizeRecipeImageUrl(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}
