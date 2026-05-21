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

  it("matches title only", () => {
    expect(recipeMatchesSearch(baseRecipe, "chicken")).toBe(true);
    expect(recipeMatchesSearch(baseRecipe, "pie")).toBe(true);
    expect(recipeMatchesSearch(baseRecipe, "pastry")).toBe(false);
    expect(recipeMatchesSearch(baseRecipe, "family")).toBe(false);
    expect(recipeMatchesSearch(baseRecipe, "dinner")).toBe(false);
  });

  it("returns false when no match", () => {
    expect(recipeMatchesSearch(baseRecipe, "lasagne")).toBe(false);
  });
});
