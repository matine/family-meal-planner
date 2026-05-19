import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type { ExtractionSource } from "@/lib/import-telemetry";

export type RecipeDraft = {
  title: string;
  ingredients: { raw: string }[];
  method: string;
  serves?: string;
  image?: string;
};

export type UrlExtractionResult = {
  draft: RecipeDraft | null;
  /** Plain text for LLM when structured draft is missing or incomplete. */
  bodyFallback: string;
  source: ExtractionSource;
};

const READABILITY_CAP = 10_000;
const REGEX_FALLBACK_CAP = 8_000;

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extractOg(html: string): { title?: string; image?: string; description?: string } {
  const metaContent = (attrs: string) => {
    const re = new RegExp(`<meta[^>]+${attrs}[^>]*>`, "i");
    const m = html.match(re);
    if (!m) return undefined;
    const c = m[0].match(/content=["']([^"']*)["']/i);
    return c ? decodeBasicEntities(c[1]!) : undefined;
  };
  const title =
    metaContent(`property=["']og:title["']`) ?? metaContent(`name=["']twitter:title["']`);
  const image =
    metaContent(`property=["']og:image["']`) ?? metaContent(`name=["']twitter:image["']`);
  const description =
    metaContent(`property=["']og:description["']`) ??
    metaContent(`name=["']twitter:description["']`);
  return { title, image, description };
}

function stripHtmlToText(html: string, max: number): string {
  const pageText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return pageText.slice(0, max);
}

/** Strip tags from a single string (e.g. JSON-LD recipeInstructions as HTML). */
function stripInlineTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isRecipeType(t: unknown): boolean {
  if (t === "Recipe") return true;
  if (Array.isArray(t) && t.some((x) => x === "Recipe")) return true;
  return false;
}

function asString(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  if (v && typeof v === "object" && typeof (v as { text?: string }).text === "string") {
    return (v as { text: string }).text.trim() || undefined;
  }
  return undefined;
}

function instructionToText(block: unknown): string {
  if (typeof block === "string") return stripInlineTags(block);
  if (!block || typeof block !== "object") return "";
  const o = block as Record<string, unknown>;
  const typ = o["@type"];
  const isListItem = typ === "ListItem" || (Array.isArray(typ) && typ.includes("ListItem"));
  const text = asString(o.text);
  const name = asString(o.name);
  if (isListItem && text) return text;
  const t = text ?? name;
  if (t) return stripInlineTags(t);
  if (Array.isArray(o.itemListElement)) {
    return o.itemListElement
      .map((el) => instructionToText(el))
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function parseInstructions(raw: unknown): string {
  if (typeof raw === "string") return stripInlineTags(raw);
  if (!raw) return "";
  if (Array.isArray(raw)) {
    return raw
      .map((x) => instructionToText(x))
      .filter(Boolean)
      .join("\n\n");
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.itemListElement)) {
      return o.itemListElement
        .map((x) => instructionToText(x))
        .filter(Boolean)
        .join("\n\n");
    }
    if (Array.isArray(o.step)) {
      return o.step
        .map((s) => instructionToText(s))
        .filter(Boolean)
        .join("\n\n");
    }
    return instructionToText(raw);
  }
  return "";
}

function parseIngredientItem(item: unknown): string | undefined {
  if (typeof item === "string") {
    const s = item.trim();
    return s || undefined;
  }
  if (!item || typeof item !== "object") return undefined;
  const o = item as Record<string, unknown>;
  const name = asString(o.name) ?? asString(o.item);
  if (!name) return undefined;
  const amt = asString(o.amount) ?? asString(o.quantity);
  if (amt) return `${amt} ${name}`.trim();
  return name;
}

function parseIngredients(raw: unknown): { raw: string }[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const out: { raw: string }[] = [];
  for (const item of list) {
    const line = parseIngredientItem(item);
    if (line) out.push({ raw: line });
  }
  return out;
}

function parseYield(y: unknown): string | undefined {
  if (typeof y === "string" || typeof y === "number") return String(y).trim() || undefined;
  if (Array.isArray(y)) {
    const parts = y.map((x) => (typeof x === "string" ? x : String(x))).filter(Boolean);
    if (parts.length) return parts.join(", ");
  }
  return undefined;
}

function collectJsonLdRoots(html: string): unknown[] {
  const roots: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      roots.push(JSON.parse(raw));
    } catch {
      /* skip invalid */
    }
  }
  return roots;
}

/** Bounded traversal: JSON-LD roots, @graph, mainEntity, hasPart — avoids scanning entire JSON trees. */
function eachJsonLdObject(html: string, visit: (o: Record<string, unknown>) => void) {
  const roots = collectJsonLdRoots(html);
  const stack: unknown[] = [...roots];
  let guard = 0;
  while (stack.length && guard++ < 3000) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (Array.isArray(cur)) {
      for (const x of cur) stack.push(x);
      continue;
    }
    const o = cur as Record<string, unknown>;
    visit(o);
    if (Array.isArray(o["@graph"])) for (const x of o["@graph"]) stack.push(x);
    if (o["mainEntity"]) stack.push(o["mainEntity"]);
    const hp = o["hasPart"];
    if (hp) {
      if (Array.isArray(hp)) for (const x of hp) stack.push(x);
      else stack.push(hp);
    }
  }
}

function pickRecipeFromJsonLd(html: string): RecipeDraft | null {
  const candidates: RecipeDraft[] = [];

  eachJsonLdObject(html, (o) => {
    if (!isRecipeType(o["@type"])) return;
    const title = asString(o.name) ?? asString(o.headline) ?? "";
    const ingredients = parseIngredients(o.recipeIngredient ?? o.ingredients);
    const method = parseInstructions(o.recipeInstructions ?? o.instructions);
    const serves = parseYield(o.recipeYield ?? o.yield);
    const imageRaw = o.image;
    let image: string | undefined;
    if (typeof imageRaw === "string") image = imageRaw;
    else if (imageRaw && typeof imageRaw === "object") {
      image = asString((imageRaw as { url?: string }).url);
    }
    if (title || ingredients.length || method) {
      candidates.push({
        title: title || "Untitled recipe",
        ingredients,
        method,
        serves,
        image,
      });
    }
  });

  if (!candidates.length) return null;
  candidates.sort(
    (a, b) => b.ingredients.length - a.ingredients.length || b.method.length - a.method.length,
  );
  return candidates[0]!;
}

function readabilityArticleText(html: string): string | null {
  try {
    const { document } = parseHTML(html);
    // linkedom Document satisfies Readability at runtime
    const article = new Readability(document as never).parse();
    const text = article?.textContent?.trim();
    if (!text) return null;
    return text.length > READABILITY_CAP ? text.slice(0, READABILITY_CAP) : text;
  } catch {
    return null;
  }
}

function mergeOgIntoDraft(
  draft: RecipeDraft | null,
  og: ReturnType<typeof extractOg>,
): RecipeDraft | null {
  if (!draft) {
    if (!og.title && !og.description) return null;
    return {
      title: og.title || "Recipe",
      ingredients: [],
      // Never use og:description as cooking steps — it is SEO/social card copy, not the method.
      method: "",
      image: og.image,
    };
  }
  const next = { ...draft };
  if (!next.title && og.title) next.title = og.title;
  if (!next.image && og.image) next.image = og.image;
  return next;
}

/**
 * Extract structured recipe data and/or cleaned text from fetched HTML.
 */
export function extractRecipeFromUrlHtml(html: string, _pageUrl: string): UrlExtractionResult {
  let draft = pickRecipeFromJsonLd(html);
  let source: ExtractionSource = draft ? "jsonld" : "regex_fallback";

  const og = extractOg(html);
  draft = mergeOgIntoDraft(draft, og);

  let bodyFallback = "";
  if (draft && draft.ingredients.length === 0 && !draft.method.trim()) {
    draft = null;
    source = "regex_fallback";
  }

  const read = readabilityArticleText(html);
  if (read) {
    if (!draft || (draft.ingredients.length === 0 && draft.method.length < 80)) {
      if (!draft) {
        draft = {
          title: og.title || "Recipe",
          ingredients: [],
          method: read,
          image: og.image,
        };
        source = "readability";
      } else if (draft.ingredients.length === 0 && draft.method.length < 80) {
        draft = { ...draft, method: draft.method ? `${draft.method}\n\n${read}` : read };
        source = draft.ingredients.length ? "jsonld" : "readability";
      }
    }
    bodyFallback = read;
  }

  if (!bodyFallback) {
    bodyFallback = stripHtmlToText(html, REGEX_FALLBACK_CAP);
  }

  if (!draft) {
    draft = mergeOgIntoDraft(null, og);
    if (draft && draft.method) source = "readability";
  }

  return { draft, bodyFallback, source };
}

/** Heuristic: enough structure to skip LLM after Zod + normalization. */
export function draftLooksComplete(d: RecipeDraft): boolean {
  return d.title.trim().length > 0 && d.ingredients.length >= 1 && d.method.trim().length >= 20;
}
