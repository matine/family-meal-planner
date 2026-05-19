import { describe, expect, it } from "vitest";
import {
  formatConvertedIngredientDisplay,
  ingredientShowsUnitConversion,
  stripRedundantSourceLine,
} from "./recipe-ingredient";

describe("formatConvertedIngredientDisplay", () => {
  it("does not parenthesise unit words in preparation", () => {
    expect(
      formatConvertedIngredientDisplay({
        amount: "1",
        name: "smoked paprika",
        preparation: "tsp",
      }),
    ).toBe("1 tsp smoked paprika");
  });
});

describe("ingredientShowsUnitConversion", () => {
  it("is false without sourceLine", () => {
    expect(ingredientShowsUnitConversion({ name: "carrot", amount: "1" })).toBe(false);
  });

  it("is false when source matches converted", () => {
    expect(
      ingredientShowsUnitConversion({
        name: "carrot",
        amount: "1",
        sourceLine: "1 carrot",
      }),
    ).toBe(false);
  });

  it("is true when cup/oz was converted", () => {
    expect(
      ingredientShowsUnitConversion({
        name: "flour",
        amount: "120 g",
        sourceLine: "1 cup flour",
      }),
    ).toBe(true);
  });
});

describe("stripRedundantSourceLine", () => {
  it("removes sourceLine when unchanged", () => {
    const out = stripRedundantSourceLine({
      name: "carrot",
      amount: "1",
      sourceLine: "1 carrot",
    });
    expect(out.sourceLine).toBeUndefined();
  });

  it("keeps sourceLine when converted", () => {
    const out = stripRedundantSourceLine({
      name: "flour",
      amount: "120 g",
      sourceLine: "1 cup flour",
    });
    expect(out.sourceLine).toBe("1 cup flour");
  });
});
