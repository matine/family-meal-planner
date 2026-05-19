import { describe, expect, it } from "vitest";
import {
  finalizeImportedIngredients,
  ingredientLineFromParts,
  ingredientLinesEquivalent,
  normalizeIngredientLine,
  reconcileFractionalQuantity,
} from "./ingredient-normalize";

describe("normalizeIngredientLine", () => {
  it("splits leading quantity and preparation tail", () => {
    const n = normalizeIngredientLine("2 tbsp extra virgin olive oil, divided");
    expect(n.amount).toBe("2 tbsp");
    expect(n.name).toBe("olive oil");
    expect(n.preparation).toContain("divided");
  });

  it("handles simple name", () => {
    const n = normalizeIngredientLine("flour");
    expect(n.name).toBe("flour");
    expect(n.amount).toBeUndefined();
  });
});

describe("ingredientLineFromParts", () => {
  it("keeps tsp with amount when model put unit in preparation", () => {
    expect(
      ingredientLineFromParts({
        amount: "1",
        name: "smoked paprika",
        preparation: "tsp",
      }),
    ).toBe("1 tsp smoked paprika");
  });

  it("does not duplicate amount already in name", () => {
    expect(
      ingredientLineFromParts({
        amount: "big handful",
        name: "big handful cavolo nero",
      }),
    ).toBe("big handful cavolo nero");
  });

  it("does not duplicate preparation already in name", () => {
    expect(
      ingredientLineFromParts({
        name: "1/2 squash, divided",
        preparation: "divided",
      }),
    ).toBe("1/2 squash, divided");
  });
});

describe("ingredientLinesEquivalent", () => {
  it("treats 150ml and 150 ml as the same", () => {
    expect(ingredientLinesEquivalent("150ml veg stock", "150 ml veg stock")).toBe(true);
  });
});

describe("reconcileFractionalQuantity", () => {
  it("restores 1/2 when AI decimalized to 0.25", () => {
    const out = reconcileFractionalQuantity({
      name: "squash",
      amount: "0.25",
      originalLine: "1/2 a squash",
    });
    expect(out.amount).toBe("1/2");
    expect(out.name).toBe("squash");
  });
});

describe("finalizeImportedIngredients", () => {
  it("preserves originalLine and drops mistaken sourceLine", () => {
    const [out] = finalizeImportedIngredients([
      {
        name: "veg stock",
        amount: "150 ml",
        originalLine: "150ml veg stock",
        sourceLine: "150ml veg stock",
      },
    ]);
    expect(out.originalLine).toBe("150ml veg stock");
    expect(out.sourceLine).toBeUndefined();
  });

  it("fixes split tsp without mangling", () => {
    const [out] = finalizeImportedIngredients([
      { name: "smoked paprika", amount: "1", preparation: "tsp" },
    ]);
    expect(out.amount).toBe("1 tsp");
    expect(out.name).toBe("smoked paprika");
    expect(out.originalLine).toBe("1 tsp smoked paprika");
  });

  it("keeps cup/oz conversion rows with sourceLine", () => {
    const [out] = finalizeImportedIngredients([
      {
        name: "flour",
        amount: "120 g",
        sourceLine: "1 cup flour",
        originalLine: "1 cup flour",
      },
    ]);
    expect(out.sourceLine).toBe("1 cup flour");
    expect(out.amount).toBe("120 g");
  });

  it("restores fractional amounts from originalLine", () => {
    const [out] = finalizeImportedIngredients([
      {
        name: "squash",
        amount: "0.25",
        originalLine: "1/2 a squash",
      },
    ]);
    expect(out.amount).toBe("1/2");
    expect(out.name).toBe("squash");
    expect(out.originalLine).toBe("1/2 a squash");
  });

  it("removes duplicate ingredient lines", () => {
    const out = finalizeImportedIngredients([
      {
        name: "Gruyere and parmesan",
        preparation: "to your hearts content",
        originalLine: "Gruyere and parmesan (to your hearts content)",
      },
      {
        name: "Gruyere and parmesan",
        originalLine: "Gruyere and parmesan (to your hearts content)",
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.originalLine).toBe("Gruyere and parmesan (to your hearts content)");
  });
});
