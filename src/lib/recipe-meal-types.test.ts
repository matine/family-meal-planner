import { describe, expect, it } from "vitest";
import {
  formatMealTypesLabel,
  mealTypesSummary,
  parseMealTypes,
  recipeMatchesMealTypeFilter,
  toggleMealType,
} from "./recipe-meal-types";

describe("parseMealTypes", () => {
  it("returns known meals in canonical order", () => {
    expect(parseMealTypes(["dinner", "breakfast", "unknown"])).toEqual(["breakfast", "dinner"]);
  });
});

describe("recipeMatchesMealTypeFilter", () => {
  it("matches any selected meal type", () => {
    const meals = parseMealTypes(["lunch", "snack"]);
    expect(recipeMatchesMealTypeFilter(meals, ["dinner"])).toBe(false);
    expect(recipeMatchesMealTypeFilter(meals, ["lunch"])).toBe(true);
    expect(recipeMatchesMealTypeFilter(meals, [])).toBe(true);
  });
});

describe("formatMealTypesLabel", () => {
  it("joins meal labels with commas", () => {
    expect(formatMealTypesLabel(["breakfast"])).toBe("Breakfast");
    expect(formatMealTypesLabel(["breakfast", "lunch", "dinner"])).toBe(
      "Breakfast, Lunch, Dinner",
    );
  });
});

describe("mealTypesSummary", () => {
  it("summarises selection for the trigger label", () => {
    expect(mealTypesSummary([])).toBe("Meals");
    expect(mealTypesSummary(["breakfast", "lunch"])).toBe("Breakfast, Lunch");
    expect(mealTypesSummary(["breakfast", "lunch", "dinner"])).toBe("3 meals");
  });
});

describe("toggleMealType", () => {
  it("adds and removes meals", () => {
    expect(toggleMealType(["breakfast"], "lunch")).toEqual(["breakfast", "lunch"]);
    expect(toggleMealType(["breakfast", "lunch"], "lunch")).toEqual(["breakfast"]);
  });
});
