/**
 * Deterministic ingredient line parsing (quantity, name, preparation).
 * Complements pantry matching; reduces reliance on the LLM for cleanup.
 */

const PREP_TAIL = /\b(divided|optional|more if needed|as needed|to taste)\b\.?$/i;

const NAME_SYNONYMS: Record<string, string> = {
  "extra virgin olive oil": "olive oil",
  "extra-virgin olive oil": "olive oil",
  evoo: "olive oil",
  scallions: "spring onion",
  scallion: "spring onion",
  "green onions": "spring onion",
  "green onion": "spring onion",
  cilantro: "coriander",
  eggplant: "aubergine",
  zucchini: "courgette",
  shrimp: "prawns",
  garbanzo: "chickpeas",
  "garbanzo beans": "chickpeas",
};

/** Leading quantity + unit (greedy enough for common recipes). */
const LEADING_QTY =
  /^([\d./\s-]+(?:\s*(?:cup|cups|tbsp|tablespoons?|tsp|teaspoons?|g|kg|ml|cl|l|oz|lb|lbs|pound|pounds|gram|grams|kilogram|kilograms|milliliters?|tablespoon|teaspoon))?\b)\s+/i;

export type NormalizedIngredientParts = {
  name: string;
  amount?: string;
  preparation?: string;
};

/** Units that belong in amount, not preparation (when the model splits them). */
const AMOUNT_UNIT_WORD =
  /^(?:tsp|teaspoons?|tbsp|tablespoons?|cup|cups|g|kg|ml|cl|l|oz|lb|lbs?|pounds?|pinch|handful)$/i;

export function isAmountUnitWord(s: string): boolean {
  return AMOUNT_UNIT_WORD.test(s.trim());
}

function phraseAlreadyContains(text: string, fragment: string): boolean {
  const f = fragment.trim().toLowerCase();
  if (!f) return true;
  return text.toLowerCase().includes(f);
}

function nameAlreadyHasAmount(name: string, amount: string): boolean {
  const n = name.trim().toLowerCase();
  const a = amount.trim().toLowerCase();
  return n === a || n.startsWith(`${a} `);
}

/** Rebuild a single line from structured fields for parsing or display. */
export function ingredientLineFromParts(ing: {
  name: string;
  amount?: string;
  preparation?: string;
}): string {
  const name = ing.name.trim();
  if (!name) return "";
  const amount = ing.amount?.trim();
  const prep = ing.preparation?.trim();

  if (prep && isAmountUnitWord(prep)) {
    if (nameAlreadyHasAmount(name, prep) || (amount && nameAlreadyHasAmount(name, amount))) {
      return name;
    }
    const qty = [amount, prep].filter(Boolean).join(" ");
    return qty ? `${qty} ${name}` : name;
  }

  const base =
    amount && !nameAlreadyHasAmount(name, amount)
      ? [amount, name].filter(Boolean).join(" ").trim()
      : name;

  if (!prep || phraseAlreadyContains(base, prep)) return base;
  return `${base}, ${prep}`;
}

/** Compare lines for “same ingredient” (ignore extra spaces before metric units). */
export function ingredientLinesEquivalent(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase()
      .replace(/(\d)\s+(ml|cl|l|g|kg|oz|lb)\b/gi, "$1$2");
  return norm(a) === norm(b);
}

const LEADING_FRACTION_LINE =
  /^(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+)(?:\s+(?:a|an|the))?\s+(.+)$/i;

/** If originalLine keeps a fraction but amount was decimalized (e.g. 1/2 → 0.25), restore it. */
export function reconcileFractionalQuantity<
  T extends { name: string; amount?: string; preparation?: string; originalLine?: string },
>(ing: T): T {
  const ol = ing.originalLine?.trim();
  if (!ol || !LEADING_FRACTION_LINE.test(ol)) return ing;

  const m = ol.match(LEADING_FRACTION_LINE);
  if (!m) return ing;

  const fractionAmount = m[1].replace(/\s+/g, " ").trim();
  const nameFromLine = m[2].trim();
  const amount = ing.amount?.trim();

  // originalLine has a leading fraction (e.g. 1/2 a squash) — never keep AI decimals (0.25, 0.5).
  if (!amount || amount !== fractionAmount) {
    return {
      ...ing,
      amount: fractionAmount,
      name: nameFromLine || ing.name,
      originalLine: ol,
    };
  }

  return ing;
}

/** Merge tsp/tbsp mistakenly placed in preparation; no other rewriting. */
export function fixSplitUnitFields<
  T extends { name: string; amount?: string; preparation?: string },
>(ing: T): T {
  const prep = ing.preparation?.trim();
  if (!prep || !isAmountUnitWord(prep)) return ing;
  const amount = [ing.amount?.trim(), prep].filter(Boolean).join(" ");
  return { ...ing, amount: amount || undefined, preparation: undefined };
}

function displayLineForIngredient(ing: {
  name: string;
  amount?: string;
  preparation?: string;
  originalLine?: string;
}): string {
  return ing.originalLine?.trim() || ingredientLineFromParts(ing);
}

function scoreImportedIngredient(ing: {
  name: string;
  amount?: string;
  preparation?: string;
  originalLine?: string;
}): number {
  const ol = ing.originalLine?.trim();
  let score = ol ? 100 + ol.length : 0;
  const line = displayLineForIngredient(ing);
  if (line.includes("(") && line.includes(")")) score += 20;
  return score;
}

/** Drop duplicate ingredient lines (AI often repeats the last line). */
export function dedupeImportedIngredients<
  T extends {
    name: string;
    amount?: string;
    preparation?: string;
    sourceLine?: string;
    originalLine?: string;
  },
>(ingredients: T[]): T[] {
  const out: T[] = [];
  for (const ing of ingredients) {
    const line = displayLineForIngredient(ing);
    if (!line) continue;
    const idx = out.findIndex((existing) =>
      ingredientLinesEquivalent(line, displayLineForIngredient(existing)),
    );
    if (idx >= 0) {
      if (scoreImportedIngredient(ing) > scoreImportedIngredient(out[idx]!)) {
        out[idx] = ing;
      }
      continue;
    }
    out.push(ing);
  }
  return out;
}

/**
 * Finalize AI-imported ingredients: preserve verbatim lines unless cup/oz conversion.
 * Does not run normalizeIngredientLine (no synonym swaps, paren stripping, or re-spacing).
 */
export function finalizeImportedIngredients<
  T extends {
    name: string;
    amount?: string;
    preparation?: string;
    sourceLine?: string;
    originalLine?: string;
  },
>(ingredients: T[]): T[] {
  const finalized = ingredients.map((ing) => {
    const next = reconcileFractionalQuantity(fixSplitUnitFields(ing));
    const source = next.sourceLine?.trim();
    const rebuilt = ingredientLineFromParts(next);
    const verbatim = next.originalLine?.trim() || rebuilt;

    const hasCupOzConversion = !!source && !ingredientLinesEquivalent(source, rebuilt);

    if (hasCupOzConversion) {
      return next;
    }

    const { sourceLine: _removed, ...rest } = next;
    return { ...rest, originalLine: verbatim };
  });
  return dedupeImportedIngredients(finalized);
}

function collapseSpace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Normalize a single ingredient display line into structured fields. */
export function normalizeIngredientLine(raw: string): NormalizedIngredientParts {
  let rest = collapseSpace(raw);
  if (!rest) return { name: "" };

  const prepBits: string[] = [];
  let prepMatch = rest.match(PREP_TAIL);
  while (prepMatch) {
    prepBits.unshift(prepMatch[1]!.toLowerCase());
    rest = collapseSpace(rest.slice(0, prepMatch.index).trim());
    rest = rest.replace(/,\s*$/, "").trim();
    prepMatch = rest.match(PREP_TAIL);
  }

  let amount: string | undefined;
  const qtyMatch = rest.match(LEADING_QTY);
  if (qtyMatch) {
    amount = collapseSpace(qtyMatch[1]!);
    rest = collapseSpace(rest.slice(qtyMatch[0].length));
  }

  let name = rest;
  const comma = name.indexOf(",");
  if (comma > 0 && comma < name.length - 1) {
    const maybePrep = name.slice(comma + 1).trim();
    name = name.slice(0, comma).trim();
    if (maybePrep) prepBits.unshift(maybePrep.toLowerCase());
  }

  name = collapseSpace(name.replace(/\([^)]*\)/g, " "));
  const key = name.toLowerCase();
  if (NAME_SYNONYMS[key]) name = NAME_SYNONYMS[key];

  const preparation = prepBits.length ? prepBits.join(", ") : undefined;
  return {
    name,
    amount,
    preparation,
  };
}

/** @deprecated Use finalizeImportedIngredients for AI import; still used by tests. */
export function normalizeParsedIngredients<
  T extends { name: string; amount?: string; preparation?: string; sourceLine?: string },
>(ingredients: T[]): T[] {
  return finalizeImportedIngredients(ingredients);
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Stable cache key for an ingredient line (lowercase, collapsed). */
export async function ingredientLineCacheKey(line: string): Promise<string> {
  const norm = line.toLowerCase().replace(/\s+/g, " ").trim();
  return sha256Hex(norm);
}
