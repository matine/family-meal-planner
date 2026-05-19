import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  approxTokensFromChars,
  logImportEvent,
  type ExtractionSource,
} from "@/lib/import-telemetry";
import {
  getCachedIngredientLine,
  getCachedRecipeImport,
  setCachedIngredientLine,
  setCachedRecipeImport,
  urlImportCacheKey,
} from "@/lib/recipe-import-cache";
import {
  draftLooksComplete,
  extractRecipeFromUrlHtml,
  type RecipeDraft,
} from "@/lib/recipe-url-extract";
import { finalizeImportedIngredients, normalizeIngredientLine } from "@/lib/ingredient-normalize";
import { formatImportedRecipeMethod } from "@/lib/recipe-method-format";
import { stripRedundantSourceLine } from "@/lib/recipe-ingredient";
import { sanitizeImportedServes } from "@/lib/recipe-serves-fallback";

function hasAiCredentials(): boolean {
  return Boolean(
    process.env.AI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim(),
  );
}

function isOpenRouterBase(baseUrl: string): boolean {
  return baseUrl.includes("openrouter.ai");
}

/** OpenAI-compatible chat/completions (OpenAI, OpenRouter, Azure-style proxies, etc.). */
function resolveAiClient(): {
  apiKey: string;
  baseUrl: string;
  modelParse: string;
  modelMatch: string;
} {
  const apiKey =
    process.env.AI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    "";
  if (!apiKey) {
    throw new Error(
      "AI is not configured. Set AI_API_KEY or OPENAI_API_KEY (or OPENROUTER_API_KEY). For OpenRouter add AI_BASE_URL=https://openrouter.ai/api/v1 and AI_MODEL=openai/gpt-4o-mini (see openrouter.ai/models). Optional: AI_MODEL_MATCH, OPENROUTER_HTTP_REFERER, OPENROUTER_APP_TITLE.",
    );
  }

  const baseUrl = (
    process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1"
  ).replace(/\/$/, "");

  const openrouterDefaults = isOpenRouterBase(baseUrl);
  const defaultParse = openrouterDefaults ? "openai/gpt-4o-mini" : "gpt-4o-mini";
  const defaultMatch = openrouterDefaults ? "openai/gpt-4o-mini" : "gpt-4o-mini";

  return {
    apiKey,
    baseUrl,
    modelParse: process.env.AI_MODEL?.trim() || defaultParse,
    modelMatch: process.env.AI_MODEL_MATCH?.trim() || process.env.AI_MODEL?.trim() || defaultMatch,
  };
}

function chatCompletionHeaders(apiKey: string, baseUrl: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (isOpenRouterBase(baseUrl)) {
    headers["HTTP-Referer"] =
      process.env.OPENROUTER_HTTP_REFERER?.trim() || "http://127.0.0.1:8080";
    headers["X-Title"] = process.env.OPENROUTER_APP_TITLE?.trim() || "Family Meal Planner";
  }
  return headers;
}

async function chatCompletions(body: Record<string, unknown>): Promise<Response> {
  const { apiKey, baseUrl } = resolveAiClient();
  return fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: chatCompletionHeaders(apiKey, baseUrl),
    body: JSON.stringify(body),
  });
}

function extractProviderErrorMessage(bodyText: string): string | undefined {
  const trimmed = bodyText.trim();
  if (!trimmed) return undefined;
  try {
    const j = JSON.parse(trimmed) as { error?: { message?: string }; message?: string };
    return j?.error?.message ?? j?.message;
  } catch {
    return trimmed.length <= 400 ? trimmed : `${trimmed.slice(0, 400)}…`;
  }
}

function mapAiHttpError(status: number, bodyText: string): Error {
  const detail = extractProviderErrorMessage(bodyText);

  if (status === 429) {
    const detailExplainsQuota =
      detail &&
      /\bquota\b|billing|exceeded your (current )?quota|insufficient|plan and billing/i.test(
        detail,
      );
    if (detailExplainsQuota && detail) {
      return new Error(detail);
    }
    const hint = "HTTP 429 from the AI provider (rate limit or quota).";
    return new Error(
      detail ? `${hint} ${detail}` : `${hint} Check usage in your provider dashboard.`,
    );
  }

  if (status === 402 || status === 403) {
    const base =
      "AI request was rejected (quota, billing, or permissions). Check your provider account.";
    return new Error(detail ? `${base} ${detail}` : base);
  }

  return new Error(
    detail ? `AI error ${status}: ${detail}` : `AI error ${status}: ${bodyText || "(empty body)"}`,
  );
}

const InputSchema = z.object({
  mode: z.enum(["url", "image", "text"]),
  payload: z.string().min(1),
});

const RecipeSchema = z.object({
  title: z.string(),
  ingredients: z.array(
    z.object({
      name: z.string(),
      amount: z.string().optional(),
      preparation: z.string().optional(),
      sourceLine: z.string().optional(),
      originalLine: z.string().optional(),
    }),
  ),
  method: z.string(),
  serves: z.string().optional(),
  source_url: z.string().optional(),
  image_url: z.string().optional(),
});

export type ParsedRecipe = z.infer<typeof RecipeSchema>;

const emptyToUndef = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);

export const StrictRecipeSchema = z.object({
  title: z.string().trim().min(1).max(400),
  method: z.string().trim().min(1).max(60000),
  ingredients: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(240),
        amount: z
          .string()
          .optional()
          .transform((s) => emptyToUndef(s)),
        preparation: z
          .string()
          .optional()
          .transform((s) => emptyToUndef(s)),
        sourceLine: z
          .string()
          .max(500)
          .optional()
          .transform((s) => emptyToUndef(s)),
        originalLine: z
          .string()
          .max(500)
          .optional()
          .transform((s) => emptyToUndef(s)),
      }),
    )
    .min(1)
    .max(120),
  serves: z
    .string()
    .optional()
    .transform((s) => emptyToUndef(s)),
  source_url: z
    .string()
    .optional()
    .transform((s) => emptyToUndef(s)),
  image_url: z
    .string()
    .optional()
    .transform((s) => emptyToUndef(s)),
});

export type ParseRecipeMeta = {
  extractionSource: ExtractionSource;
  promptChars: number;
  approxPromptTokens: number;
  model?: string;
  llmSkipped?: boolean;
  cacheHit?: boolean;
  htmlBytes?: number;
};

export type ParseRecipeResponse = ParsedRecipe & { meta?: ParseRecipeMeta };

function saveRecipeTool() {
  return {
    type: "function" as const,
    function: {
      name: "save_recipe",
      description: "Save a structured recipe.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          ingredients: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                amount: {
                  type: "string",
                  description:
                    "Quantity including its unit when present, e.g. '1 tsp', '1/2', '2 cups', '200 g'. Keep fractions as fractions (1/2 not 0.5). Only convert to metric (ml/l or g/kg) when the source uses US cups or ounces (oz); otherwise keep exactly as written.",
                },
                preparation: {
                  type: "string",
                  description:
                    "Prep notes only (chopped, diced, divided) — never put tsp, tbsp, cups, or g here.",
                },
                sourceLine: {
                  type: "string",
                  description:
                    "Verbatim phrase before cup/oz conversion only. Omit unless you converted US cups or ounces.",
                },
                originalLine: {
                  type: "string",
                  description:
                    "Exact ingredient phrase as written in the source: same words, order, spacing, and punctuation. Required for every ingredient.",
                },
              },
              required: ["name", "originalLine"],
              additionalProperties: false,
            },
          },
          method: {
            type: "string",
            description:
              "Step-by-step cooking method; one step per line with a single newline between steps (no blank lines). You may convert Fahrenheit oven temperatures to °C (gas mark in brackets optional).",
          },
          serves: {
            type: "string",
            description:
              "Only when the source explicitly states servings (e.g. 'Serves 4', 'Feeds 6'). Omit entirely if not stated — never guess.",
          },
        },
        required: ["title", "ingredients", "method"],
        additionalProperties: false,
      },
    },
  };
}

const UK_IMPORT_NORMALIZATION =
  "Copy every ingredient exactly into originalLine (do not reword, reorder, add/remove spaces, duplicate words, or move parenthetical notes). Each source ingredient line must appear exactly once in the list — never duplicate an ingredient. Only change text when the source uses US cups or ounces (oz/fl oz): convert those to metric, set sourceLine to the original verbatim phrase, and put the converted phrase in amount/name/preparation. Do NOT change ml, g, kg, l, tsp, tbsp, counts (1 carrot), fractions (keep 1/2 not 0.5 or 0.25), or ingredient names. Never convert fractions or count-based amounts to decimals. Do not put the same words in both name and amount. Omit sourceLine when no cup/oz conversion. Omit serves unless the source explicitly states how many people it feeds — never invent a serving count. Method: Fahrenheit oven temps may become °C.";

const SYSTEM_FULL = `You extract recipes from text, web pages, or images. Always call the save_recipe tool. Field \`method\` is cooking steps only — not site promos, bios, or navigation. Prefer preserving real ingredients and steps; do not invent ingredients. Every ingredient needs originalLine copied verbatim from the source. Split amount (with unit) vs name only for structuring; never duplicate amount text inside name. Preparation is only for chop/dice/divided-style notes, never for tsp/tbsp/cups/g/ml. ${UK_IMPORT_NORMALIZATION}`;

const SYSTEM_COMPACT = `You receive pre-extracted recipe data (JSON and/or cleaned article text). Call save_recipe. Field \`method\` must be step-by-step cooking directions only — never SEO blurbs, author bios, comments, 'jump to recipe', newsletter prompts, or unrelated page copy. If pre-extracted \`method\` looks like marketing text or is empty, derive steps from the article excerpt or omit junk. Fix duplicates only; do not invent ingredients. ${UK_IMPORT_NORMALIZATION}`;

const SYSTEM_REPAIR = `The recipe failed validation. Call save_recipe with a corrected structure. Fix the listed issues; keep the same recipe content where possible. ${UK_IMPORT_NORMALIZATION}`;
async function draftToParsedWithCache(
  draft: RecipeDraft,
  sourceUrl: string,
): Promise<ParsedRecipe> {
  const ingredients: ParsedRecipe["ingredients"] = [];
  for (const { raw } of draft.ingredients) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const cached = await getCachedIngredientLine(trimmed);
    const parts = cached ?? normalizeIngredientLine(trimmed);
    if (!cached) await setCachedIngredientLine(trimmed, parts);
    if (parts.name)
      ingredients.push({ name: parts.name, amount: parts.amount, preparation: parts.preparation });
  }
  return {
    title: draft.title.trim(),
    ingredients,
    method: formatImportedRecipeMethod(draft.method),
    serves: draft.serves?.trim(),
    source_url: sourceUrl,
    image_url: draft.image?.trim(),
  };
}

function buildUrlLlmUserContent(
  extracted: ReturnType<typeof extractRecipeFromUrlHtml>,
  pageUrl: string,
): { content: string | unknown[]; approxChars: number } {
  const d = extracted.draft;
  if (d && (d.ingredients.length > 0 || d.method.length > 0)) {
    const compact: Record<string, unknown> = {
      title: d.title,
      ingredients: d.ingredients.map((i) => i.raw),
      method: d.method.length > 6000 ? `${d.method.slice(0, 6000)}\n…` : d.method,
      cleanedArticleExcerpt:
        extracted.bodyFallback.length > 2500 ? extracted.bodyFallback.slice(0, 2500) : undefined,
    };
    if (d.serves?.trim()) compact.serves = d.serves.trim();
    else compact.servesNote = "No serving count in pre-extracted data — omit the serves field.";
    const s = JSON.stringify(compact);
    const msg = `URL: ${pageUrl}\n\nPre-extracted data (trust ingredients/method below; use excerpt only to fill gaps):\n${s}`;
    return { content: msg, approxChars: msg.length };
  }
  const fb =
    extracted.bodyFallback.length > 6000
      ? extracted.bodyFallback.slice(0, 6000)
      : extracted.bodyFallback;
  const msg = `Extract the recipe from this page text. URL: ${pageUrl}\n\nContent:\n${fb}`;
  return { content: msg, approxChars: msg.length };
}

async function callSaveRecipeLlm(params: {
  userContent: string | unknown[];
  system: string;
  model: string;
}): Promise<{ raw: ParsedRecipe; promptChars: number; providerHttpStatus: number }> {
  const tool = saveRecipeTool();
  const promptChars =
    typeof params.userContent === "string"
      ? params.userContent.length
      : JSON.stringify(params.userContent).length;
  const resp = await chatCompletions({
    model: params.model,
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.userContent },
    ],
    tools: [tool],
    tool_choice: { type: "function", function: { name: "save_recipe" } },
  });
  if (!resp.ok) throw mapAiHttpError(resp.status, await resp.text());
  const json = await resp.json();
  const call = json.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) throw new Error("Could not parse a recipe from that input.");
  const args = JSON.parse(call.function.arguments) as ParsedRecipe;
  return { raw: args, promptChars, providerHttpStatus: resp.status };
}

function finalizeRecipe(
  raw: ParsedRecipe,
  sourceUrl?: string,
  sourceText?: string,
): ParsedRecipe {
  const merged = {
    ...raw,
    ingredients: finalizeImportedIngredients(raw.ingredients).map(stripRedundantSourceLine),
    method: formatImportedRecipeMethod(raw.method),
    serves: sanitizeImportedServes(raw.serves, sourceText),
    source_url: raw.source_url ?? sourceUrl,
  };
  return merged;
}

async function persistLineCaches(ingredients: ParsedRecipe["ingredients"]): Promise<void> {
  for (const ing of ingredients) {
    const line =
      ing.originalLine?.trim() ||
      [ing.amount, ing.name].filter(Boolean).join(" ").trim();
    if (line)
      await setCachedIngredientLine(line, {
        name: ing.name,
        amount: ing.amount,
        preparation: ing.preparation,
      });
  }
}

export const parseRecipe = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<ParseRecipeResponse> => {
    const t0 = Date.now();
    let extractionSource: ExtractionSource =
      data.mode === "text" ? "text" : data.mode === "image" ? "image" : "regex_fallback";
    let promptChars = 0;
    let model: string | undefined;
    let llmSkipped = false;
    let cacheHit = false;
    let htmlBytes: number | undefined;
    let sourceUrl: string | undefined;
    let providerHttpStatus: number | undefined;

    const metaBase = (): ParseRecipeMeta => ({
      extractionSource,
      promptChars,
      approxPromptTokens: approxTokensFromChars(promptChars),
      model,
      llmSkipped,
      cacheHit,
      htmlBytes,
    });

    const succeed = (recipe: ParsedRecipe, extra?: Partial<ParseRecipeMeta>) => {
      const latencyMs = Date.now() - t0;
      logImportEvent({
        phase: "parseRecipe",
        mode: data.mode,
        extractionSource,
        htmlBytes,
        promptChars,
        approxPromptTokens: approxTokensFromChars(promptChars),
        model,
        llmSkipped,
        cacheHit,
        providerHttpStatus,
        latencyMs,
        outcome: "success",
      });
      return { ...recipe, meta: { ...metaBase(), ...extra } };
    };

    const fail = (err: unknown): never => {
      const latencyMs = Date.now() - t0;
      const msg = err instanceof Error ? err.message : String(err);
      logImportEvent({
        phase: "parseRecipe",
        mode: data.mode,
        extractionSource,
        htmlBytes,
        promptChars,
        approxPromptTokens: approxTokensFromChars(promptChars),
        model,
        llmSkipped,
        cacheHit,
        providerHttpStatus,
        latencyMs,
        outcome: "error",
        error: msg,
      });
      throw err instanceof Error ? err : new Error(msg);
    };

    try {
      if (data.mode === "url") {
        sourceUrl = data.payload;
        const urlHash = await urlImportCacheKey(data.payload);
        const cached = await getCachedRecipeImport(urlHash);
        if (cached) {
          const v = StrictRecipeSchema.safeParse(cached);
          if (v.success) {
            cacheHit = true;
            extractionSource = "cache";
            return succeed(v.data, {
              extractionSource: "cache",
              cacheHit: true,
              llmSkipped: true,
              promptChars: 0,
            });
          }
        }

        let html = "";
        try {
          const res = await fetch(data.payload, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; FamilyKitchenBot/1.0)" },
          });
          html = await res.text();
        } catch {
          html = "";
        }
        htmlBytes = new TextEncoder().encode(html).length;
        const extracted = extractRecipeFromUrlHtml(html, data.payload);
        extractionSource = extracted.source;

        if (extracted.draft && draftLooksComplete(extracted.draft)) {
          const candidate = await draftToParsedWithCache(extracted.draft, data.payload);
          const v = StrictRecipeSchema.safeParse(candidate);
          if (v.success) {
            llmSkipped = true;
            extractionSource = "structured_skip_llm";
            await setCachedRecipeImport(urlHash, v.data, extractionSource);
            await persistLineCaches(v.data.ingredients);
            return succeed(v.data, {
              extractionSource: "structured_skip_llm",
              llmSkipped: true,
              htmlBytes,
              promptChars: 0,
            });
          }
        }

        if (!hasAiCredentials()) {
          throw new Error(
            "AI is not configured. Set AI_API_KEY or OPENAI_API_KEY (OpenAI-compatible APIs). Optional: AI_BASE_URL (default https://api.openai.com/v1), AI_MODEL, AI_MODEL_MATCH.",
          );
        }
        const { modelParse } = resolveAiClient();
        model = modelParse;
        const { content, approxChars } = buildUrlLlmUserContent(extracted, data.payload);
        promptChars = approxChars;
        const useCompact = Boolean(extracted.draft?.ingredients.length || extracted.draft?.method);

        let { raw, providerHttpStatus: st } = await callSaveRecipeLlm({
          userContent: content,
          system: useCompact ? SYSTEM_COMPACT : SYSTEM_FULL,
          model: modelParse,
        });
        providerHttpStatus = st;
        const sourceText = extracted.bodyFallback;
        let out = finalizeRecipe(raw, data.payload, sourceText);
        let validated = StrictRecipeSchema.safeParse(out);
        if (!validated.success) {
          const repairMsg = `Validation issues:\n${JSON.stringify(validated.error.flatten())}\n\nPrevious:\n${JSON.stringify(out).slice(0, 4500)}`;
          ({ raw, providerHttpStatus: st } = await callSaveRecipeLlm({
            userContent: repairMsg,
            system: SYSTEM_REPAIR,
            model: modelParse,
          }));
          providerHttpStatus = st;
          out = finalizeRecipe(raw, data.payload, sourceText);
          validated = StrictRecipeSchema.safeParse(out);
          if (!validated.success) {
            throw new Error(`Recipe validation failed: ${validated.error.message}`);
          }
        }
        await setCachedRecipeImport(urlHash, validated.data, extractionSource);
        await persistLineCaches(validated.data.ingredients);
        return succeed(validated.data, { htmlBytes });
      }

      if (data.mode === "image") {
        if (!hasAiCredentials()) {
          throw new Error(
            "AI is not configured. Set AI_API_KEY or OPENAI_API_KEY (OpenAI-compatible APIs). Optional: AI_BASE_URL (default https://api.openai.com/v1), AI_MODEL, AI_MODEL_MATCH.",
          );
        }
        extractionSource = "image";
        const { modelParse } = resolveAiClient();
        model = modelParse;
        const userContent: unknown[] = [
          {
            type: "text",
            text: "Extract the recipe shown in this cookbook photo. Return title, ingredients (each with originalLine copied verbatim from the photo), and full method/instructions. Only convert US cups or ounces to metric; set sourceLine only when you convert those. Do not reword, add spaces, or duplicate text. Only include serves if the photo explicitly states how many people it feeds.",
          },
          { type: "image_url", image_url: { url: data.payload } },
        ];
        promptChars = JSON.stringify(userContent).length;
        let { raw, providerHttpStatus: st } = await callSaveRecipeLlm({
          userContent,
          system: SYSTEM_FULL,
          model: modelParse,
        });
        providerHttpStatus = st;
        let out = finalizeRecipe(raw, undefined);
        let validated = StrictRecipeSchema.safeParse(out);
        if (!validated.success) {
          const repairMsg = `Validation issues:\n${JSON.stringify(validated.error.flatten())}\n\nPrevious:\n${JSON.stringify(out).slice(0, 4500)}`;
          ({ raw, providerHttpStatus: st } = await callSaveRecipeLlm({
            userContent: repairMsg,
            system: SYSTEM_REPAIR,
            model: modelParse,
          }));
          providerHttpStatus = st;
          out = finalizeRecipe(raw, undefined);
          validated = StrictRecipeSchema.safeParse(out);
          if (!validated.success) {
            throw new Error(`Recipe validation failed: ${validated.error.message}`);
          }
        }
        await persistLineCaches(validated.data.ingredients);
        return succeed(validated.data);
      }

      // text
      extractionSource = "text";
      if (!hasAiCredentials()) {
        throw new Error(
          "AI is not configured. Set AI_API_KEY or OPENAI_API_KEY (OpenAI-compatible APIs). Optional: AI_BASE_URL (default https://api.openai.com/v1), AI_MODEL, AI_MODEL_MATCH.",
        );
      }
      const { modelParse } = resolveAiClient();
      model = modelParse;
      const textPayload =
        data.payload.length > 14000 ? `${data.payload.slice(0, 14000)}\n…` : data.payload;
      const userContent = `Parse this recipe text:\n\n${textPayload}`;
      promptChars = userContent.length;
      let { raw, providerHttpStatus: st } = await callSaveRecipeLlm({
        userContent,
        system: SYSTEM_FULL,
        model: modelParse,
      });
      providerHttpStatus = st;
      let out = finalizeRecipe(raw, undefined, textPayload);
      let validated = StrictRecipeSchema.safeParse(out);
      if (!validated.success) {
        const repairMsg = `Validation issues:\n${JSON.stringify(validated.error.flatten())}\n\nPrevious:\n${JSON.stringify(out).slice(0, 4500)}`;
        ({ raw, providerHttpStatus: st } = await callSaveRecipeLlm({
          userContent: repairMsg,
          system: SYSTEM_REPAIR,
          model: modelParse,
        }));
        providerHttpStatus = st;
        out = finalizeRecipe(raw, undefined, textPayload);
        validated = StrictRecipeSchema.safeParse(out);
        if (!validated.success) {
          throw new Error(`Recipe validation failed: ${validated.error.message}`);
        }
      }
      await persistLineCaches(validated.data.ingredients);
      return succeed(validated.data);
    } catch (e) {
      return fail(e);
    }
  });

const SuggestInputSchema = z.object({
  unmatched: z.array(z.string().min(1)).min(1).max(50),
  pantry: z.array(z.string().min(1)).max(500),
});

export const suggestIngredientMatches = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SuggestInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { modelMatch } = resolveAiClient();

    const tool = {
      type: "function",
      function: {
        name: "match_ingredients",
        description:
          "For each raw ingredient name, return the best pantry name match (or null if none reasonable).",
        parameters: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  raw: { type: "string" },
                  match: {
                    type: ["string", "null"],
                    description: "An exact pantry name from the provided list, or null.",
                  },
                },
                required: ["raw", "match"],
                additionalProperties: false,
              },
            },
          },
          required: ["suggestions"],
          additionalProperties: false,
        },
      },
    };

    const resp = await chatCompletions({
      model: modelMatch,
      messages: [
        {
          role: "system",
          content:
            "You map raw recipe ingredient names to canonical pantry names. Only return a match if it is the same ingredient (synonyms or close variants like 'scallion' -> 'spring onion' are fine; different ingredients are not). Use exact strings from the pantry list, or null when nothing fits.",
        },
        {
          role: "user",
          content: `Pantry items:\n${data.pantry.map((p) => `- ${p}`).join("\n") || "(empty)"}\n\nRaw ingredient names to match:\n${data.unmatched.map((u) => `- ${u}`).join("\n")}`,
        },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "match_ingredients" } },
    });

    if (!resp.ok) throw mapAiHttpError(resp.status, await resp.text());

    const json = await resp.json();
    const call = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return { suggestions: [] as { raw: string; match: string | null }[] };
    const args = JSON.parse(call.function.arguments);
    return args as { suggestions: { raw: string; match: string | null }[] };
  });
