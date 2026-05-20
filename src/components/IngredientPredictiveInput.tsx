import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { recipeFieldInvalidClass } from "@/lib/recipe-form-validation";
import { cn } from "@/lib/utils";
import { suggestCanonicals, type CanonicalLite } from "@/lib/canonical";
import { cap } from "@/lib/text";

export type IngredientPredictiveInputProps = {
  canonicals: CanonicalLite[];
  value: string;
  onChange: (name: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** Called when the user explicitly picks an existing canonical from the list. */
  onPick?: (c: CanonicalLite) => void;
  /** Highlight as a required field that still needs a value. */
  invalid?: boolean;
};

const DROPDOWN_MAX_HEIGHT = 224;

type DropdownPlacement = {
  /** Portal mount; must stay inside Radix Dialog content so RemoveScroll shards receive clicks. */
  root: HTMLElement;
  style: CSSProperties;
};

/**
 * Predictive-text style input: shows a ghost completion of the top suggestion
 * inline (Tab / ArrowRight to accept) plus a small popover list of matches.
 */
export function IngredientPredictiveInput({
  canonicals,
  value,
  onChange,
  onSubmit,
  onPick,
  placeholder = "Ingredient",
  className,
  inputClassName,
  invalid = false,
}: IngredientPredictiveInputProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState<DropdownPlacement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const blurCloseTimerRef = useRef<number | null>(null);
  /** Suppress duplicate accept when both mousedown (mouse) and click (keyboard) fire. */
  const pickViaMouseRef = useRef(false);

  const clearBlurCloseTimer = useCallback(() => {
    if (blurCloseTimerRef.current != null) {
      window.clearTimeout(blurCloseTimerRef.current);
      blurCloseTimerRef.current = null;
    }
  }, []);

  const matches = useMemo(() => suggestCanonicals(value, canonicals, 6), [value, canonicals]);
  const top = matches[0];
  // Only show ghost if the top match starts-with what the user typed (case-insensitive).
  const ghost = useMemo(() => {
    if (!top || !value) return "";
    const v = value.toLowerCase();
    const n = top.name.toLowerCase();
    if (n.startsWith(v) && n !== v) return top.name.slice(value.length);
    return "";
  }, [top, value]);

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
    if (!open || matches.length === 0) {
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
  }, [open, matches.length, updatePlacement]);

  useEffect(() => () => clearBlurCloseTimer(), [clearBlurCloseTimer]);

  const accept = (c: CanonicalLite) => {
    clearBlurCloseTimer();
    onChange(cap(c.name));
    onPick?.(c);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab" || e.key === "ArrowRight") {
      if (ghost) {
        e.preventDefault();
        accept(top!);
        return;
      }
    }
    if (e.key === "ArrowDown") {
      if (matches.length) {
        e.preventDefault();
        setOpen(true);
        setActive((i) => Math.min(i + 1, matches.length - 1));
      }
      return;
    }
    if (e.key === "ArrowUp") {
      if (matches.length) {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      }
      return;
    }
    if (e.key === "Enter") {
      if (open && matches.length && matches[active]) {
        e.preventDefault();
        accept(matches[active]);
        return;
      }
      if (onSubmit) {
        e.preventDefault();
        onSubmit();
      }
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const dropdown =
    open && matches.length > 0 && placement ? (
      <ul
        ref={listRef}
        style={placement.style}
        className="max-h-56 overflow-auto rounded-lg border bg-popover"
      >
        {matches.map((m, i) => (
          <li key={m.id}>
            <button
              type="button"
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                pickViaMouseRef.current = true;
                accept(m);
              }}
              onClick={() => {
                if (pickViaMouseRef.current) {
                  pickViaMouseRef.current = false;
                  return;
                }
                accept(m);
              }}
              className={cn(
                "flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-accent",
                i === active && "bg-accent",
              )}
            >
              <span className="truncate">{cap(m.name)}</span>
              {i === 0 && ghost && (
                <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                  tab ↹
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        {/* Ghost layer */}
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
          className={cn(
            "relative bg-transparent",
            inputClassName,
            invalid && recipeFieldInvalidClass,
          )}
          aria-invalid={invalid || undefined}
          autoComplete="off"
        />
      </div>
      {typeof document !== "undefined" && dropdown && placement
        ? createPortal(dropdown, placement.root)
        : null}
    </div>
  );
}
