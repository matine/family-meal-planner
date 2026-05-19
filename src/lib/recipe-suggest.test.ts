import { describe, expect, it } from "vitest";
import { recipeTitleGhost, suggestRecipes } from "./recipe-suggest";

const RECIPES = [
  { id: "1", title: "Green curry" },
  { id: "2", title: "Spinach frittata" },
  { id: "3", title: "Pizza night" },
];

describe("suggestRecipes", () => {
  it("returns starts-with matches before contains", () => {
    expect(suggestRecipes("spi", RECIPES).map((r) => r.title)).toEqual(["Spinach frittata"]);
  });

  it("returns empty for blank query", () => {
    expect(suggestRecipes("  ", RECIPES)).toEqual([]);
  });
});

describe("recipeTitleGhost", () => {
  it("completes partial title", () => {
    expect(recipeTitleGhost("gree", { id: "1", title: "Green curry" })).toBe("n curry");
  });
});
