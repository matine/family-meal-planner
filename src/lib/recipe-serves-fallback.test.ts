import { describe, expect, it } from "vitest";
import { sanitizeImportedServes, servesMentionedInSource } from "./recipe-serves-fallback";

describe("servesMentionedInSource", () => {
  it("matches explicit serves wording", () => {
    expect(servesMentionedInSource("4", "A hearty soup. Serves 4 with crusty bread.")).toBe(true);
    expect(servesMentionedInSource("6", "Feeds 6 as a main course.")).toBe(true);
  });

  it("rejects invented counts with no serve context", () => {
    expect(servesMentionedInSource("4", "Add 4 tbsp olive oil and bake for 20 minutes.")).toBe(
      false,
    );
  });
});

describe("sanitizeImportedServes", () => {
  it("drops serves when not in source text", () => {
    expect(
      sanitizeImportedServes("4", "2 onions\n1 carrot\nBake until golden."),
    ).toBeUndefined();
  });

  it("keeps serves when source mentions it", () => {
    expect(sanitizeImportedServes("4", "Serves 4\nIngredients…")).toBe("4");
  });

  it("keeps serves when no source text to verify (e.g. photo)", () => {
    expect(sanitizeImportedServes("4", undefined)).toBe("4");
  });
});
