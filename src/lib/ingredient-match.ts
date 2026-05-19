// Local-first ingredient matching: zero AI by default.
// Pantry is the source of truth; aliases learn from user choices.

export type PantryLite = { id: string; name: string; category?: string | null };
export type AliasMap = Record<string, string>; // normalized alias -> ingredient_id

// Hand-curated synonym map. Maps a normalized raw term to a canonical name
// (also normalized). Grows over time, no AI cost.
const SYNONYMS: Record<string, string> = {
  scallion: "spring onion",
  scallions: "spring onion",
  "green onion": "spring onion",
  "green onions": "spring onion",
  cilantro: "coriander",
  "coriander leaves": "coriander",
  passata: "tinned tomatoes",
  "chopped tomatoes": "tinned tomatoes",
  "plum tomatoes": "tinned tomatoes",
  "tinned plum tomatoes": "tinned tomatoes",
  "canned tomatoes": "tinned tomatoes",
  aubergine: "aubergine",
  eggplant: "aubergine",
  courgette: "courgette",
  zucchini: "courgette",
  "bell pepper": "pepper",
  capsicum: "pepper",
  garbanzo: "chickpeas",
  "garbanzo beans": "chickpeas",
  "olive oil": "olive oil",
  evoo: "olive oil",
  "extra virgin olive oil": "olive oil",
  prawns: "prawns",
  shrimp: "prawns",
};

const QTY_PREFIX = /^[\d¼½¾⅓⅔⅛⅜⅝⅞.,/\s-]*(?:cup|cups|tbsp|tsp|tablespoon|teaspoon|g|kg|ml|l|oz|lb|pound|clove|cloves|pinch|handful|can|cans|tin|tins|jar|jars|pack|packet|slice|slices|bunch|sprig|sprigs)?\s*(?:of\s+)?/i;

export function normalize(raw: string): string {
  let s = raw.toLowerCase().trim();
  s = s.replace(/\([^)]*\)/g, " "); // strip parenthesised notes
  s = s.replace(/,.*$/, ""); // strip trailing notes after a comma
  s = s.replace(QTY_PREFIX, "");
  s = s.replace(/\b(fresh|dried|chopped|sliced|minced|ground|whole|raw|cooked|large|small|medium|ripe|peeled|crushed)\b/g, " ");
  s = s.replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  // Crude singularize: trailing 'es' or 's'
  if (s.endsWith("ies") && s.length > 4) s = s.slice(0, -3) + "y";
  else if (s.endsWith("es") && s.length > 4 && !/(ses|ches|shes|xes)$/.test(s)) s = s.slice(0, -2);
  else if (s.endsWith("s") && s.length > 3) s = s.slice(0, -1);
  return s;
}

function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      out.set(bg, (out.get(bg) ?? 0) + 1);
    }
    return out;
  };
  const ba = bigrams(a);
  const bb = bigrams(b);
  let inter = 0, total = 0;
  for (const [, v] of ba) total += v;
  for (const [, v] of bb) total += v;
  for (const [k, v] of ba) {
    const w = bb.get(k);
    if (w) inter += Math.min(v, w);
  }
  return (2 * inter) / total;
}

export type MatchResult = {
  raw: string;
  status: "exact" | "alias" | "synonym" | "fuzzy" | "unmatched";
  ingredientId?: string;
  pantryName?: string;
  confidence: number; // 0..1
};

export function matchIngredient(
  raw: string,
  pantry: PantryLite[],
  aliases: AliasMap,
): MatchResult {
  const norm = normalize(raw);
  if (!norm) return { raw, status: "unmatched", confidence: 0 };

  // 1. Learned alias (exact normalized hit)
  const aliasId = aliases[norm];
  if (aliasId) {
    const p = pantry.find((x) => x.id === aliasId);
    if (p) return { raw, status: "alias", ingredientId: p.id, pantryName: p.name, confidence: 1 };
  }

  // 2. Exact match against pantry
  const pantryNorm = pantry.map((p) => ({ p, n: normalize(p.name) }));
  const exact = pantryNorm.find((x) => x.n === norm);
  if (exact) return { raw, status: "exact", ingredientId: exact.p.id, pantryName: exact.p.name, confidence: 1 };

  // 3. Synonym map
  const syn = SYNONYMS[norm];
  if (syn) {
    const hit = pantryNorm.find((x) => x.n === syn);
    if (hit) return { raw, status: "synonym", ingredientId: hit.p.id, pantryName: hit.p.name, confidence: 0.95 };
  }

  // 4. Token-substring (whole word containment in either direction)
  for (const { p, n } of pantryNorm) {
    if (!n) continue;
    const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (re.test(norm)) return { raw, status: "fuzzy", ingredientId: p.id, pantryName: p.name, confidence: 0.9 };
    const re2 = new RegExp(`\\b${norm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    if (re2.test(n)) return { raw, status: "fuzzy", ingredientId: p.id, pantryName: p.name, confidence: 0.88 };
  }

  // 5. Fuzzy (Dice)
  let best: { p: PantryLite; score: number } | null = null;
  for (const { p, n } of pantryNorm) {
    const s = dice(norm, n);
    if (!best || s > best.score) best = { p, score: s };
  }
  if (best && best.score >= 0.6) {
    return {
      raw,
      status: "fuzzy",
      ingredientId: best.p.id,
      pantryName: best.p.name,
      confidence: best.score,
    };
  }

  return { raw, status: "unmatched", confidence: 0 };
}

export function matchAll(
  rawNames: string[],
  pantry: PantryLite[],
  aliases: AliasMap,
): MatchResult[] {
  return rawNames.map((r) => matchIngredient(r, pantry, aliases));
}

/** Fuzzy matches below this confidence are offered to AI alongside unmatched rows. */
export const AI_PANTRY_CONFIDENCE_THRESHOLD = 0.85;
