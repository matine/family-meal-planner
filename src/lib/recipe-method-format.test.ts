import { describe, expect, it } from "vitest";
import {
  formatImportedRecipeMethod,
  hasNumberedMethodSteps,
  methodDisplayLines,
  parseMethodDisplayLine,
} from "./recipe-method-format";

describe("formatImportedRecipeMethod", () => {
  it("numbers plain line-separated steps with single newlines between", () => {
    const raw = "Preheat oven.\nMix dry ingredients.\nBake for 20 minutes.";
    expect(formatImportedRecipeMethod(raw)).toBe(
      "1. Preheat oven.\n2. Mix dry ingredients.\n3. Bake for 20 minutes.",
    );
  });

  it("collapses blank lines when already numbered", () => {
    const raw = "1. Preheat oven.\n\n2. Mix dry ingredients.";
    expect(formatImportedRecipeMethod(raw)).toBe("1. Preheat oven.\n2. Mix dry ingredients.");
    expect(hasNumberedMethodSteps(raw)).toBe(true);
  });

  it("does not duplicate Step N labels", () => {
    const raw = "Step 1: Preheat\nStep 2: Bake";
    expect(formatImportedRecipeMethod(raw)).toBe(raw);
  });

  it("splits paragraph blocks separated by blank lines", () => {
    const raw = "Preheat oven to 180°C.\n\nMix flour and sugar.";
    expect(formatImportedRecipeMethod(raw)).toBe(
      "1. Preheat oven to 180°C.\n2. Mix flour and sugar.",
    );
  });
});

describe("methodDisplayLines", () => {
  it("returns one entry per line", () => {
    expect(methodDisplayLines("1. A\n2. B")).toEqual(["1. A", "2. B"]);
  });
});

describe("parseMethodDisplayLine", () => {
  it("splits numeric step prefix from body", () => {
    expect(parseMethodDisplayLine("1. Preheat the oven.")).toEqual({
      type: "numbered",
      label: "1.",
      body: "Preheat the oven.",
    });
  });

  it("splits Step N labels", () => {
    expect(parseMethodDisplayLine("Step 2: Mix flour")).toEqual({
      type: "numbered",
      label: "Step 2:",
      body: "Mix flour",
    });
  });

  it("returns plain lines unchanged", () => {
    expect(parseMethodDisplayLine("Preheat the oven.")).toEqual({
      type: "plain",
      text: "Preheat the oven.",
    });
  });
});
