import { describe, expect, it } from "vitest";
import { recipeMatchesSearch } from "./recipe-search";
import type { Recipe } from "@/hooks/useTable";

const baseRecipe = {
  id: "1",
  created_at: "",
  title: "Chicken pie",
  method: "Bake until golden",
  ingredients: [{ name: "chicken breast" }, { name: "puff pastry" }],
  tags: ["Family"],
  meal_types: ["dinner"],
  cook_time_minutes: 45,
  serves: "4",
  source_url: null,
  image_url: null,
} as Recipe;

describe("recipeMatchesSearch", () => {
  it("matches empty query", () => {
    expect(recipeMatchesSearch(baseRecipe, "")).toBe(true);
  });

  it("matches title and ingredients", () => {
    expect(recipeMatchesSearch(baseRecipe, "chicken")).toBe(true);
    expect(recipeMatchesSearch(baseRecipe, "pastry")).toBe(true);
  });

  it("matches tags and meal types", () => {
    expect(recipeMatchesSearch(baseRecipe, "family")).toBe(true);
    expect(recipeMatchesSearch(baseRecipe, "dinner")).toBe(true);
  });

  it("returns false when no match", () => {
    expect(recipeMatchesSearch(baseRecipe, "lasagne")).toBe(false);
  });
});
