import { describe, expect, it } from "vitest";
import {
  getRecipePantryStatus,
  parseRecipeTags,
  recipeMatchesInPantryFilter,
  recipeMatchesTagFilter,
} from "./recipe-tags";

describe("parseRecipeTags", () => {
  it("returns known tags in canonical order", () => {
    expect(parseRecipeTags(["Keto", "Quick", "Unknown"])).toEqual(["Quick", "Keto"]);
  });

  it("returns empty for non-arrays", () => {
    expect(parseRecipeTags(null)).toEqual([]);
  });
});

describe("recipeMatchesTagFilter", () => {
  it("matches any selected tag", () => {
    const tags = parseRecipeTags(["Quick", "Family"]);
    expect(recipeMatchesTagFilter(tags, ["Keto"])).toBe(false);
    expect(recipeMatchesTagFilter(tags, ["Quick"])).toBe(true);
    expect(recipeMatchesTagFilter(tags, [])).toBe(true);
  });
});

describe("getRecipePantryStatus", () => {
  it("counts only required ingredients", () => {
    const status = getRecipePantryStatus(
      {
        ingredients: [
          { name: "flour", canonicalId: "c1" },
          { name: "sugar", canonicalId: "c2", optional: true },
          { name: "salt", canonicalId: "c3" },
        ],
      },
      new Set(["c1", "c3"]),
    );
    expect(status).toEqual({ totalRequired: 2, haveRequired: 2, haveAll: true });
  });
});

describe("recipeMatchesInPantryFilter", () => {
  it("filters in-pantry when active", () => {
    const full = { totalRequired: 2, haveRequired: 2, haveAll: true };
    const partial = { totalRequired: 2, haveRequired: 1, haveAll: false };
    expect(recipeMatchesInPantryFilter(full, true)).toBe(true);
    expect(recipeMatchesInPantryFilter(partial, true)).toBe(false);
    expect(recipeMatchesInPantryFilter(partial, false)).toBe(true);
  });
});
