import type { ParseRecipeResponse } from "@/lib/recipes.functions";

const STORAGE_KEY = "family-meal-planner:recipe-import-draft";

export function setRecipeImportDraft(draft: ParseRecipeResponse): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function getRecipeImportDraft(): ParseRecipeResponse | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ParseRecipeResponse;
  } catch {
    return null;
  }
}

export function clearRecipeImportDraft(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
