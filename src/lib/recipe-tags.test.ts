import { describe, expect, it } from "vitest";
import {
  formatCookTime,
  getRecipePantryStatus,
  parseCookTimeFilterId,
  parseCookTimeMinutes,
  parseRecipeTags,
  recipeMatchesCookTimeFilter,
  recipeMatchesInPantryFilter,
  recipeMatchesTagFilter,
} from "./recipe-tags";

describe("parseRecipeTags", () => {
  it("returns known tags in canonical order", () => {
    expect(parseRecipeTags(["Keto", "Low effort", "Quick", "Unknown"])).toEqual([
      "Low effort",
      "Keto",
    ]);
  });

  it("returns empty for non-arrays", () => {
    expect(parseRecipeTags(null)).toEqual([]);
  });
});

describe("parseCookTimeMinutes", () => {
  it("parses positive integers", () => {
    expect(parseCookTimeMinutes(25)).toBe(25);
    expect(parseCookTimeMinutes("40")).toBe(40);
    expect(parseCookTimeMinutes(0)).toBeNull();
    expect(parseCookTimeMinutes(null)).toBeNull();
  });
});

describe("formatCookTime", () => {
  it("formats minutes and hours", () => {
    expect(formatCookTime(25)).toBe("25 min");
    expect(formatCookTime(90)).toBe("1h 30m");
    expect(formatCookTime(60)).toBe("1h");
  });
});

describe("recipeMatchesTagFilter", () => {
  it("matches only when recipe has all selected tags", () => {
    const tags = parseRecipeTags(["Low effort", "Family"]);
    expect(recipeMatchesTagFilter(tags, ["Keto"])).toBe(false);
    expect(recipeMatchesTagFilter(tags, ["Low effort"])).toBe(true);
    expect(recipeMatchesTagFilter(tags, ["Low effort", "Family"])).toBe(true);
    expect(recipeMatchesTagFilter(tags, ["Low effort", "Keto"])).toBe(false);
    expect(recipeMatchesTagFilter(tags, [])).toBe(true);
  });
});

describe("recipeMatchesCookTimeFilter", () => {
  it("matches when cook time is within a selected max", () => {
    expect(recipeMatchesCookTimeFilter(25, [30])).toBe(true);
    expect(recipeMatchesCookTimeFilter(45, [30])).toBe(false);
    expect(recipeMatchesCookTimeFilter(null, [30])).toBe(false);
    expect(recipeMatchesCookTimeFilter(20, [])).toBe(true);
  });
});

describe("parseCookTimeFilterId", () => {
  it("parses cook filter ids", () => {
    expect(parseCookTimeFilterId("cook-30")).toBe(30);
    expect(parseCookTimeFilterId("in-pantry")).toBeNull();
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
