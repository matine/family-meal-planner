export type RecipeLite = { id: string; title: string };

/** Suggest recipes whose title starts-with or includes the typed query. */
export function suggestRecipes(query: string, recipes: RecipeLite[], limit = 6): RecipeLite[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const starts: RecipeLite[] = [];
  const contains: RecipeLite[] = [];
  for (const r of recipes) {
    const t = r.title.toLowerCase();
    if (t.startsWith(q)) starts.push(r);
    else if (t.includes(q)) contains.push(r);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Inline ghost suffix for the top recipe suggestion (Tab / ArrowRight to accept). */
export function recipeTitleGhost(query: string, top: RecipeLite | undefined): string {
  if (!top || !query) return "";
  const v = query.toLowerCase();
  const t = top.title.toLowerCase();
  if (t.startsWith(v) && t !== v) return top.title.slice(query.length);
  return "";
}
