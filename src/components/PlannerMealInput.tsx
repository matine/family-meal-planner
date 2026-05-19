import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { BookOpen, PenLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  recipeTitleGhost,
  suggestRecipes,
  type RecipeLite,
} from "@/lib/recipe-suggest";

export type PlannerMealInputProps = {
  recipes: RecipeLite[];
  value: string;
  onChange: (value: string) => void;
  onPickRecipe: (recipe: RecipeLite) => void;
  onQuickAdd: (label: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
};

const DROPDOWN_MAX_HEIGHT = 224;

type DropdownPlacement = {
  root: HTMLElement;
  style: CSSProperties;
};

type DropdownRow =
  | { kind: "recipe"; recipe: RecipeLite }
  | { kind: "quick"; label: string };

/**
 * Search recipes or add a one-off text note (no recipe created).
 * Same interaction model as {@link IngredientPredictiveInput}.
 */
export function PlannerMealInput({
  recipes,
  value,
  onChange,
  onPickRecipe,
  onQuickAdd,
  placeholder = "Search or quick add…",
  className,
  inputClassName,
  disabled,
}: PlannerMealInputProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState<DropdownPlacement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const blurCloseTimerRef = useRef<number | null>(null);
  const pickViaMouseRef = useRef(false);

  const clearBlurCloseTimer = useCallback(() => {
    if (blurCloseTimerRef.current != null) {
      window.clearTimeout(blurCloseTimerRef.current);
      blurCloseTimerRef.current = null;
    }
  }, []);

  const recipeMatches = useMemo(() => suggestRecipes(value, recipes, 6), [value, recipes]);
  const top = recipeMatches[0];
  const ghost = useMemo(() => recipeTitleGhost(value, top), [value, top]);
  const quickLabel = value.trim();

  const rows: DropdownRow[] = useMemo(() => {
    const out: DropdownRow[] = recipeMatches.map((recipe) => ({ kind: "recipe", recipe }));
    if (quickLabel) out.push({ kind: "quick", label: quickLabel });
    return out;
  }, [recipeMatches, quickLabel]);

  useEffect(() => {
    setActive(0);
  }, [value]);

  const updatePlacement = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow;

    const dialog = el.closest<HTMLElement>('[role="dialog"]');
    const base: CSSProperties = {
      width: rect.width,
      maxHeight: DROPDOWN_MAX_HEIGHT,
      zIndex: 100,
    };

    if (dialog) {
      const pr = dialog.getBoundingClientRect();
      if (openUp) {
        setPlacement({
          root: dialog,
          style: {
            position: "absolute",
            left: rect.left - pr.left,
            bottom: pr.bottom - rect.top + 4,
            ...base,
          },
        });
      } else {
        setPlacement({
          root: dialog,
          style: {
            position: "absolute",
            left: rect.left - pr.left,
            top: rect.bottom - pr.top + 4,
            ...base,
          },
        });
      }
      return;
    }

    if (openUp) {
      setPlacement({
        root: document.body,
        style: {
          position: "fixed",
          left: rect.left,
          bottom: window.innerHeight - rect.top + 4,
          ...base,
        },
      });
    } else {
      setPlacement({
        root: document.body,
        style: {
          position: "fixed",
          left: rect.left,
          top: rect.bottom + 4,
          ...base,
        },
      });
    }
  }, []);

  useEffect(() => {
    if (!open || rows.length === 0) {
      setPlacement(null);
      return;
    }
    updatePlacement();
    window.addEventListener("scroll", updatePlacement, true);
    window.addEventListener("resize", updatePlacement);
    return () => {
      window.removeEventListener("scroll", updatePlacement, true);
      window.removeEventListener("resize", updatePlacement);
    };
  }, [open, rows.length, updatePlacement]);

  useEffect(() => () => clearBlurCloseTimer(), [clearBlurCloseTimer]);

  const acceptRow = (row: DropdownRow) => {
    clearBlurCloseTimer();
    if (row.kind === "recipe") {
      onPickRecipe(row.recipe);
      onChange("");
    } else {
      onQuickAdd(row.label);
      onChange("");
    }
    setOpen(false);
  };

  const acceptTopRecipe = () => {
    if (!top) return;
    acceptRow({ kind: "recipe", recipe: top });
  };

  const submitQuickOrOnly = () => {
    if (!quickLabel) return;
    onQuickAdd(quickLabel);
    onChange("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab" || e.key === "ArrowRight") {
      if (ghost && top) {
        e.preventDefault();
        acceptTopRecipe();
        return;
      }
    }
    if (e.key === "ArrowDown") {
      if (rows.length) {
        e.preventDefault();
        setOpen(true);
        setActive((i) => Math.min(i + 1, rows.length - 1));
      }
      return;
    }
    if (e.key === "ArrowUp") {
      if (rows.length) {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && rows.length && rows[active]) {
        acceptRow(rows[active]);
        return;
      }
      if (recipeMatches.length > 0 && top) {
        acceptTopRecipe();
        return;
      }
      submitQuickOrOnly();
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const dropdown =
    open && rows.length > 0 && placement ? (
      <ul
        ref={listRef}
        style={placement.style}
        className="max-h-56 overflow-auto rounded-lg border bg-popover shadow-md"
      >
        {rows.map((row, i) => (
          <li key={row.kind === "recipe" ? row.recipe.id : "quick"}>
            <button
              type="button"
              disabled={disabled}
              onMouseDown={(ev) => {
                if (ev.button !== 0) return;
                ev.preventDefault();
                pickViaMouseRef.current = true;
                acceptRow(row);
              }}
              onClick={() => {
                if (pickViaMouseRef.current) {
                  pickViaMouseRef.current = false;
                  return;
                }
                acceptRow(row);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent",
                i === active && "bg-accent",
                row.kind === "quick" && "border-t text-muted-foreground",
              )}
            >
              {row.kind === "recipe" ? (
                <>
                  <BookOpen className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {row.recipe.title}
                  </span>
                  {i === 0 && ghost && (
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                      tab ↹
                    </span>
                  )}
                </>
              ) : (
                <>
                  <PenLine className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="min-w-0 flex-1 truncate">
                    Add &ldquo;{row.label}&rdquo; as note
                  </span>
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <div className={cn("relative min-w-0 flex-1", className)}>
      <div className="relative">
        {ghost && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center px-3 text-sm"
          >
            <span className="invisible whitespace-pre">{value}</span>
            <span className="text-muted-foreground/60">{ghost}</span>
          </div>
        )}
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            clearBlurCloseTimer();
            setOpen(true);
            updatePlacement();
          }}
          onBlur={(e) => {
            const rt = e.relatedTarget;
            if (rt instanceof Node && listRef.current?.contains(rt)) return;
            clearBlurCloseTimer();
            blurCloseTimerRef.current = window.setTimeout(() => {
              blurCloseTimerRef.current = null;
              setOpen(false);
            }, 120);
          }}
          onKeyDown={onKeyDown}
          className={cn("relative h-8 bg-transparent text-sm", inputClassName)}
          autoComplete="off"
        />
      </div>
      {typeof document !== "undefined" && dropdown && placement
        ? createPortal(dropdown, placement.root)
        : null}
    </div>
  );
}
