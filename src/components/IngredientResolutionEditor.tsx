import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { IngredientPredictiveInput } from "@/components/IngredientPredictiveInput";
import type { RecipeIngredient } from "@/hooks/useTable";
import { useCanonicals } from "@/hooks/useCanonicals";
import { useAliases, rememberAlias } from "@/hooks/useAliases";
import {
  AI_PANTRY_CONFIDENCE_THRESHOLD,
  matchAll,
  normalize,
  type MatchResult,
  type PantryLite,
} from "@/lib/ingredient-match";
import { resolveOrCreateCanonical } from "@/lib/canonical";
import { cn } from "@/lib/utils";
import { suggestIngredientMatches } from "@/lib/recipesFunctions";
import {
  formatConvertedIngredientDisplay,
  formatOriginalIngredientLine,
  ingredientCanonicalIds,
  ingredientMatchRaw,
  ingredientShowsUnitConversion,
  packCanonicalRefs,
} from "@/lib/recipe-ingredient";
import { normalizeIngredientLine } from "@/lib/ingredient-normalize";
import { cap } from "@/lib/text";
import { toast } from "sonner";
import { IngredientConversionLine } from "@/components/IngredientConversionLine";
import { IngredientInlineLineEdit } from "@/components/IngredientInlineLineEdit";
export type IngredientResolutionRow = { key: string; ingredient: RecipeIngredient };

type PantryMatch = { id: string; name: string };

/** Stable fingerprint of which pantry items are mapped (order-independent). */
function matchIdsSignature(matches: PantryMatch[]): string {
  return [...matches]
    .map((m) => m.id)
    .sort()
    .join("|");
}

type Resolution = {
  raw: string;
  originalLine: string;
  matches: PantryMatch[];
};

export type IngredientResolutionEditorHandle = {
  finalize: () => Promise<RecipeIngredient[]>;
};

export type IngredientResolutionGate = {
  /** Every row has at least one library mapping (manual pick, saved canonical ids, or AI). */
  allMatched: boolean;
  aiLoading: boolean;
};

export type IngredientResolutionEditorProps = {
  rows: IngredientResolutionRow[];
  onRowsChange?: (next: IngredientResolutionRow[]) => void;
  allowAddRemove?: boolean;
  /** Run pantry AI matching on mount (e.g. after importing a recipe). */
  autoSuggestAi?: boolean;
  disabled?: boolean;
  /** Fires when mapping completeness or AI busy state changes (e.g. to gate Save). */
  onResolutionGateChange?: (gate: IngredientResolutionGate) => void;
  /** Red outline on match inputs that still need a library mapping. */
  showRequiredErrors?: boolean;
};

export const IngredientResolutionEditor = forwardRef<
  IngredientResolutionEditorHandle,
  IngredientResolutionEditorProps
>(function IngredientResolutionEditor(
  {
    rows,
    onRowsChange,
    allowAddRemove = false,
    autoSuggestAi = false,
    disabled = false,
    onResolutionGateChange,
    showRequiredErrors = false,
  },
  ref,
) {
  const {
    rows: canonicals,
    loading: canonicalsLoading,
    refresh: refreshCanonicals,
  } = useCanonicals();
  const autoSuggestRanForRef = useRef<string | null>(null);
  const { aliases, refresh: refreshAliases } = useAliases();

  const [overrides, setOverrides] = useState<Record<string, Resolution>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [pickQuery, setPickQuery] = useState<Record<string, string>>({});

  const validKeys = useMemo(() => new Set(rows.map((r) => r.key)), [rows]);

  useEffect(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (!validKeys.has(k)) delete next[k];
      }
      return next;
    });
    setPickQuery((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (!validKeys.has(k)) delete next[k];
      }
      return next;
    });
  }, [validKeys]);

  const pantryLite: PantryLite[] = useMemo(
    () => canonicals.map((c) => ({ id: c.id, name: c.name })),
    [canonicals],
  );

  const baseMatches = useMemo<MatchResult[]>(
    () =>
      matchAll(
        rows.map((r) => {
          const fromOv = overrides[r.key]?.originalLine?.trim();
          if (fromOv) return fromOv;
          return ingredientMatchRaw(r.ingredient);
        }),
        pantryLite,
        aliases,
      ),
    [rows, overrides, pantryLite, aliases],
  );

  /** Only show tags from saved canonical refs — not local fuzzy/alias guesses (those are AI-only on import). */
  const defaultResolution = useCallback(
    (row: IngredientResolutionRow): Resolution => {
      const ing = row.ingredient;
      const line = formatOriginalIngredientLine(ing);
      const rawStr = ingredientMatchRaw(ing);
      const fromIds = ingredientCanonicalIds(ing)
        .map((id) => pantryLite.find((p) => p.id === id))
        .filter((p): p is PantryLite => !!p)
        .map((p) => ({ id: p.id, name: p.name }));
      if (fromIds.length) {
        return { raw: rawStr, originalLine: line, matches: fromIds };
      }
      return { raw: rawStr, originalLine: line, matches: [] };
    },
    [pantryLite],
  );

  const resolutionAt = useCallback(
    (key: string, rowIndex: number): Resolution => {
      const row = rows[rowIndex];
      if (!row) return { raw: "", originalLine: "", matches: [] };
      return overrides[key] ?? defaultResolution(row);
    },
    [rows, overrides, defaultResolution],
  );

  const setResolution = (key: string, next: Resolution) =>
    setOverrides((prev) => ({ ...prev, [key]: next }));

  const addMatch = (key: string, rowIndex: number, c: PantryLite) => {
    const cur = resolutionAt(key, rowIndex);
    if (cur.matches.some((m) => m.id === c.id)) return;
    setResolution(key, { ...cur, matches: [...cur.matches, { id: c.id, name: c.name }] });
  };

  const removeMatch = (key: string, rowIndex: number, id: string) => {
    const cur = resolutionAt(key, rowIndex);
    setResolution(key, { ...cur, matches: cur.matches.filter((m) => m.id !== id) });
  };

  const rowModels = rows.map((row, rowIndex) => {
    const m = baseMatches[rowIndex];
    const resolution = resolutionAt(row.key, rowIndex);
    return { key: row.key, row, rowIndex, match: m, resolution };
  });

  const needsAiResolution = rowModels.filter((r) => {
    const { matches } = r.resolution;
    if (!matches.length) return true;
    if (
      matches.length === 1 &&
      r.match.status === "fuzzy" &&
      r.match.confidence < AI_PANTRY_CONFIDENCE_THRESHOLD
    )
      return true;
    return false;
  });

  const askAi = useCallback(
    async (options?: { quiet?: boolean }) => {
      if (!needsAiResolution.length) return;
      // Snapshot rows the AI will touch + match signatures *before* await. When the request is
      // slow, the user can add alternates or pick from search; applying stale results would
      // overwrite their work (see match signature guard after await).
      const targets = needsAiResolution.map((r) => {
        const rowRes = resolutionAt(r.key, r.rowIndex);
        const rawKey = rowRes.originalLine.trim() || ingredientMatchRaw(r.row.ingredient);
        return {
          key: r.key,
          row: r.row,
          rowIndex: r.rowIndex,
          matchMeta: r.match,
          rawKey,
          sigAtStart: matchIdsSignature(rowRes.matches),
        };
      });
      setAiLoading(true);
      try {
        const suggestionResponse = await suggestIngredientMatches({
          data: {
            unmatched: targets.map((t) => t.rawKey),
            pantry: pantryLite.map((p) => p.name),
          },
        });
        const appliedCount = { n: 0 };
        setOverrides((prev) => {
          let acc = prev;
          let copied = false;
          let batchApplied = 0;
          const touch = () => {
            if (!copied) {
              acc = { ...prev };
              copied = true;
            }
          };
          for (const t of targets) {
            const fresh = acc[t.key] ?? defaultResolution(t.row);
            if (matchIdsSignature(fresh.matches) !== t.sigAtStart) continue;

            const sug = suggestionResponse.suggestions.find(
              (s: { raw: string; match: string | null }) => s.raw === t.rawKey,
            );
            const matchName = sug?.match;
            if (!matchName) continue;
            const hit = pantryLite.find((p) => normalize(p.name) === normalize(matchName));
            if (!hit) continue;

            const cur = fresh;
            let nextMatches = cur.matches;
            if (!cur.matches.length) {
              nextMatches = [{ id: hit.id, name: hit.name }];
            } else if (
              cur.matches.length === 1 &&
              t.matchMeta.status === "fuzzy" &&
              t.matchMeta.confidence < AI_PANTRY_CONFIDENCE_THRESHOLD
            ) {
              nextMatches = [{ id: hit.id, name: hit.name }];
            } else if (!cur.matches.some((m) => m.id === hit.id)) {
              nextMatches = [...cur.matches, { id: hit.id, name: hit.name }];
            }
            if (nextMatches !== cur.matches) {
              touch();
              acc[t.key] = { ...cur, matches: nextMatches };
              batchApplied++;
            }
          }
          appliedCount.n = batchApplied;
          return acc;
        });
        if (!options?.quiet) {
          toast.success(
            appliedCount.n
              ? `AI matched ${appliedCount.n} ingredient${appliedCount.n === 1 ? "" : "s"}`
              : "AI couldn't find more matches",
          );
        }
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "AI suggestion failed");
      } finally {
        setAiLoading(false);
      }
    },
    // resolutionAt / defaultResolution read overrides + rows; needsAiResolution captures row list.
    [
      needsAiResolution,
      pantryLite,
      rows,
      overrides,
      baseMatches,
      aliases,
      defaultResolution,
      resolutionAt,
    ],
  );

  useEffect(() => {
    if (!onResolutionGateChange) return;
    if (canonicalsLoading) {
      onResolutionGateChange({ allMatched: false, aiLoading });
      return;
    }
    const allMatched =
      rows.length > 0 &&
      rows.every((row) => {
        const res = overrides[row.key] ?? defaultResolution(row);
        return res.matches.length > 0;
      });
    onResolutionGateChange({ allMatched, aiLoading });
  }, [
    rows,
    overrides,
    aiLoading,
    canonicalsLoading,
    pantryLite,
    aliases,
    defaultResolution,
    onResolutionGateChange,
  ]);

  useEffect(() => {
    if (!autoSuggestAi || disabled || canonicalsLoading || aiLoading) return;
    const fingerprint = rows.map((r) => r.key).join("|");
    if (autoSuggestRanForRef.current === fingerprint) return;
    if (!needsAiResolution.length) {
      autoSuggestRanForRef.current = fingerprint;
      return;
    }
    autoSuggestRanForRef.current = fingerprint;
    void askAi({ quiet: true });
  }, [
    autoSuggestAi,
    disabled,
    canonicalsLoading,
    aiLoading,
    rows,
    needsAiResolution.length,
    askAi,
  ]);

  const addNewCanonicalToRow = async (key: string, rowIndex: number) => {
    const name = (pickQuery[key] ?? "").trim();
    if (!name) {
      toast.error("Enter a name for the new ingredient");
      return;
    }
    if (canonicals.some((c) => normalize(c.name) === normalize(name))) {
      toast.info("Pick this ingredient from the suggestions list");
      return;
    }
    try {
      const can = await resolveOrCreateCanonical(name, canonicals, aliases, {
        skipAliases: true,
      });
      if (!can) return;
      addMatch(key, rowIndex, can);
      await Promise.all([refreshCanonicals(), refreshAliases()]);
      setPickQuery((prev) => ({ ...prev, [key]: "" }));
      toast.success(`Added “${cap(can.name)}” to your library`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not add ingredient");
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      finalize: async (): Promise<RecipeIngredient[]> => {
        const finalIngredients: RecipeIngredient[] = [];
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
          const row = rows[rowIndex];
          const res = resolutionAt(row.key, rowIndex);
          const savedLine = res.originalLine.trim() || formatOriginalIngredientLine(row.ingredient);
          const rawForAlias =
            res.originalLine.trim() || res.raw.trim() || ingredientMatchRaw(row.ingredient);
          const matches = [...res.matches];
          if (!matches.length) {
            throw new Error("Map every ingredient to your library before saving.");
          }
          const ids = matches.map((m) => m.id);
          const primary = ids[0];
          if (primary && normalize(rawForAlias) !== normalize(matches[0].name)) {
            await rememberAlias(rawForAlias, primary);
          }
          const refs = packCanonicalRefs(ids);
          finalIngredients.push({
            name: savedLine || row.ingredient.name,
            originalLine: savedLine || undefined,
            amount: row.ingredient.amount,
            preparation: row.ingredient.preparation,
            ...(row.ingredient.optional ? { optional: true } : {}),
            ...refs,
          });
        }
        return finalIngredients;
      },
    }),
    [aliases, canonicals, overrides, rows, pantryLite, defaultResolution, resolutionAt],
  );

  const removeRow = (idx: number) => {
    if (!onRowsChange) return;
    onRowsChange(rows.filter((_, i) => i !== idx));
  };

  const setRowOptional = (rowIndex: number, optional: boolean) => {
    if (!onRowsChange) return;
    onRowsChange(
      rows.map((row, i) => {
        if (i !== rowIndex) return row;
        const { optional: _prev, ...rest } = row.ingredient;
        return {
          ...row,
          ingredient: optional ? { ...rest, optional: true } : rest,
        };
      }),
    );
  };

  const addRow = () => {
    if (!onRowsChange) return;
    onRowsChange([
      ...rows,
      {
        key: crypto.randomUUID(),
        ingredient: { name: "" },
      },
    ]);
  };

  const applyIngredientLine = (rowIndex: number, next: RecipeIngredient) => {
    if (!onRowsChange) return;
    const oldKey = rows[rowIndex]?.key;
    const newKey = crypto.randomUUID();
    const line = formatConvertedIngredientDisplay(next) || formatOriginalIngredientLine(next);
    onRowsChange(rows.map((row, i) => (i === rowIndex ? { key: newKey, ingredient: next } : row)));
    if (oldKey) {
      setOverrides((prev) => {
        const cur = prev[oldKey];
        if (!cur) return prev;
        const { [oldKey]: _removed, ...rest } = prev;
        return { ...rest, [newKey]: { ...cur, originalLine: line, raw: line } };
      });
      setPickQuery((prev) => {
        if (!(oldKey in prev)) return prev;
        const { [oldKey]: q, ...rest } = prev;
        return { ...rest, [newKey]: q };
      });
    }
  };

  const commitIngredientLineText = (
    rowIndex: number,
    line: string,
    preserveSourceLine: boolean,
  ) => {
    const trimmed = line.trim();
    if (!trimmed) {
      toast.error("Ingredient line cannot be empty");
      return;
    }
    const parts = normalizeIngredientLine(trimmed);
    if (!parts.name.trim()) {
      toast.error("Could not read an ingredient name from that line");
      return;
    }
    const row = rows[rowIndex];
    if (!row) return;
    const sl = preserveSourceLine ? row.ingredient.sourceLine?.trim() : undefined;
    applyIngredientLine(rowIndex, {
      name: parts.name,
      amount: parts.amount,
      preparation: parts.preparation,
      ...(sl ? { sourceLine: sl } : {}),
      ...(!preserveSourceLine ? { originalLine: trimmed } : {}),
      ...(row.ingredient.canonicalId ? { canonicalId: row.ingredient.canonicalId } : {}),
      ...(row.ingredient.canonicalIds?.length ? { canonicalIds: row.ingredient.canonicalIds } : {}),
      ...(row.ingredient.optional ? { optional: true } : {}),
    });
  };

  return (
    <div className="min-w-0 pb-8">
      {autoSuggestAi && aiLoading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Matching ingredients with your library…
        </p>
      )}
      <ul className="min-w-0 divide-y overflow-visible rounded-lg border bg-white">
        {rowModels.map((r) => {
          const res = r.resolution;
          const pickVal = pickQuery[r.key] ?? "";
          const pickTrim = pickVal.trim();
          const queryMatchesLibrary =
            !!pickTrim && canonicals.some((c) => normalize(c.name) === normalize(pickTrim));
          const canAddNewFromQuery = !!pickTrim && !queryMatchesLibrary;
          const showUnitConversion = ingredientShowsUnitConversion(r.row.ingredient);
          const displayLine =
            res.originalLine.trim() || formatOriginalIngredientLine(r.row.ingredient);

          return (
            <li
              key={r.key}
              className="relative flex min-w-0 flex-col gap-3 overflow-visible px-3 py-3 sm:px-4"
            >
              {allowAddRemove && onRowsChange && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 h-8 w-8 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => removeRow(r.rowIndex)}
                  disabled={disabled}
                  aria-label="Remove ingredient row"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <div className={cn("min-w-0 w-full", allowAddRemove && onRowsChange && "pr-10")}>
                {showUnitConversion ? (
                  <IngredientConversionLine
                    ingredient={r.row.ingredient}
                    disabled={disabled}
                    onCommit={(next) => applyIngredientLine(r.rowIndex, next)}
                  />
                ) : (
                  <IngredientInlineLineEdit
                    value={displayLine}
                    disabled={disabled}
                    onCommit={(line) => commitIngredientLineText(r.rowIndex, line, false)}
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id={`optional-${r.key}`}
                  checked={Boolean(r.row.ingredient.optional)}
                  onCheckedChange={(checked) => setRowOptional(r.rowIndex, checked === true)}
                  disabled={disabled || !onRowsChange}
                  className="h-5 w-5 bg-white data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                />
                <Label
                  htmlFor={`optional-${r.key}`}
                  className="cursor-pointer text-xs font-normal text-muted-foreground"
                >
                  Optional ingredient
                </Label>
              </div>

              <div className="flex min-w-0 flex-row items-end gap-2">
                <IngredientPredictiveInput
                  canonicals={canonicals}
                  value={pickVal}
                  onChange={(v) => setPickQuery((prev) => ({ ...prev, [r.key]: v }))}
                  onPick={(c) => {
                    addMatch(r.key, r.rowIndex, c);
                    setPickQuery((prev) => ({ ...prev, [r.key]: "" }));
                  }}
                  onSubmit={() => {
                    if (canAddNewFromQuery) void addNewCanonicalToRow(r.key, r.rowIndex);
                  }}
                  placeholder="Match to ingredients in your library"
                  className="min-w-0 flex-1"
                  inputClassName="!bg-white"
                  invalid={showRequiredErrors && res.matches.length === 0}
                />
                <Button
                  type="button"
                  variant={canAddNewFromQuery ? "default" : "outline"}
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => void addNewCanonicalToRow(r.key, r.rowIndex)}
                  disabled={disabled || !canAddNewFromQuery}
                  aria-label="Add ingredient to library"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {res.matches.length > 0 && (
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {res.matches.map((m) => (
                    <Badge
                      key={m.id}
                      variant="muted"
                      className="max-w-full gap-0.5 pr-1 font-normal"
                    >
                      <span className="truncate">{cap(m.name)}</span>
                      <button
                        type="button"
                        className="rounded p-0.5 hover:bg-muted-foreground/20"
                        aria-label={`Remove ${m.name}`}
                        onClick={() => removeMatch(r.key, r.rowIndex, m.id)}
                        disabled={disabled}
                      >
                        <X className="h-3 w-3 shrink-0 opacity-70" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {allowAddRemove && onRowsChange && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={addRow}
          disabled={disabled}
          className="mt-4"
          aria-label="Add ingredient"
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
});
