import { describe, expect, it } from "vitest";
import { extractRecipeFromUrlHtml, draftLooksComplete } from "./recipe-url-extract";

const jsonLdHtml = `<!DOCTYPE html><html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Test Soup",
  "recipeIngredient": ["2 cups water", "1 tsp salt"],
  "recipeInstructions": {"@type": "HowToSection", "name": "Cook", "itemListElement": [
    {"@type": "HowToStep", "text": "Boil water."},
    {"@type": "HowToStep", "text": "Add salt and simmer."}
  ]},
  "recipeYield": "4 servings"
}
</script>
</head><body><nav>junk nav links</nav><p>Ignore this prose.</p></body></html>`;

const plainArticleHtml = `<!DOCTYPE html><html><head>
<meta property="og:title" content="Plain Stew" />
<meta property="og:description" content="A hearty stew description for the card." />
<title>Site</title>
</head><body>
<article><h1>Plain Stew</h1>
<p>You need beef and carrots. Brown the meat then simmer for one hour.</p>
</article>
</body></html>`;

describe("extractRecipeFromUrlHtml", () => {
  it("extracts schema.org Recipe from JSON-LD", () => {
    const r = extractRecipeFromUrlHtml(jsonLdHtml, "https://example.com/r");
    expect(r.source).toBe("jsonld");
    expect(r.draft).not.toBeNull();
    expect(r.draft!.title).toBe("Test Soup");
    expect(r.draft!.ingredients.map((i) => i.raw)).toEqual(["2 cups water", "1 tsp salt"]);
    expect(r.draft!.method).toContain("Boil water");
    expect(r.draft!.serves).toContain("4");
    expect(draftLooksComplete(r.draft!)).toBe(true);
  });

  it("does not put og:description into method when JSON-LD has ingredients but no instructions", () => {
    const html = `<html><head>
<meta property="og:description" content="Buy our cookbook — the best SEO blurb ever." />
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Recipe","name":"Quick Salad","recipeIngredient":["lettuce","tomato"]}
</script></head><body></body></html>`;
    const r = extractRecipeFromUrlHtml(html, "https://example.com/x");
    expect(r.draft?.ingredients.length).toBe(2);
    expect(r.draft?.method).not.toContain("cookbook");
    expect(r.draft?.method).not.toContain("SEO");
  });

  it("falls back to readability-style article when no JSON-LD", () => {
    const r = extractRecipeFromUrlHtml(plainArticleHtml, "https://example.com/p");
    expect(r.draft).not.toBeNull();
    expect(r.draft!.title).toBe("Plain Stew");
    expect(r.bodyFallback.length).toBeGreaterThan(10);
  });
});
