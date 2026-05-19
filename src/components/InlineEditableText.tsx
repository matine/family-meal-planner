import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const textClass = "text-base font-medium leading-snug md:text-sm";
const nowrapTextClass = `${textClass} whitespace-nowrap`;
const wrapTextClass = `${textClass} break-words whitespace-normal`;

/** Input box model — sizer uses this only while editing so widths match. */
const inputBoxClass =
  "box-border rounded-md border border-input px-1.5 py-1 text-base font-medium leading-snug md:text-sm";
const nowrapInputBoxClass = `${inputBoxClass} whitespace-nowrap`;
const wrapInputBoxClass = `${inputBoxClass} break-words whitespace-normal`;

type Props = {
  value: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  /** Allow long text to wrap (e.g. ingredient lines on narrow screens). */
  wrap?: boolean;
  /** When value is empty, show an input with this placeholder instead of click-to-edit. */
  emptyPlaceholder?: string;
  /** Extra classes on the `<Input>` (e.g. `!bg-white` to match other fields in a form). */
  inputClassName?: string;
  onCommit: (line: string) => void;
};

/** Click-to-edit text sized to its content (no wrap); white highlight on hover / while editing. */
export function InlineEditableText({
  value,
  disabled,
  className,
  ariaLabel = "Edit text",
  wrap = false,
  emptyPlaceholder,
  inputClassName,
  onCommit,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const measure = (editing ? draft : value) || "\u00a0";
  const displayTextClass = wrap ? wrapTextClass : nowrapTextClass;
  const displayInputBoxClass = wrap ? wrapInputBoxClass : nowrapInputBoxClass;
  const isEmpty = !value.trim();
  const showEmptyInput = Boolean(emptyPlaceholder && isEmpty);
  const fieldInputClassName = cn("w-full min-w-0 max-w-full", inputClassName);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const startEdit = () => {
    if (disabled) return;
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== value.trim()) onCommit(trimmed);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const inputKeyHandlers = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  if (wrap && showEmptyInput) {
    return (
      <span className={cn("block w-full min-w-0", className)}>
        <Input
          value={draft}
          placeholder={emptyPlaceholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={inputKeyHandlers}
          spellCheck={false}
          disabled={disabled}
          className={fieldInputClassName}
          aria-label={ariaLabel}
        />
      </span>
    );
  }

  if (wrap) {
    return (
      <span className={cn("block w-full min-w-0", className)}>
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={inputKeyHandlers}
            spellCheck={false}
            disabled={disabled}
            className={
              inputClassName
                ? fieldInputClassName
                : cn(
                    "h-auto min-h-0 w-full min-w-0 max-w-full bg-white shadow-none",
                    displayInputBoxClass,
                  )
            }
            aria-label={ariaLabel}
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={startEdit}
            className={cn(
              "w-full rounded px-1 py-0.5 text-left transition-colors hover:bg-white",
              displayTextClass,
              disabled && "pointer-events-none opacity-50",
            )}
            aria-label={ariaLabel}
          >
            {value || "—"}
          </button>
        )}
      </span>
    );
  }

  return (
    <span className={cn("inline-grid max-w-full align-baseline", className)}>
      <span
        className={cn(
          "invisible col-start-1 row-start-1 min-w-0",
          editing ? displayInputBoxClass : cn(displayTextClass, "px-1 py-0.5"),
        )}
        aria-hidden
      >
        {measure}
      </span>
      {editing ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          spellCheck={false}
          disabled={disabled}
          className={cn(
            "col-start-1 row-start-1 h-auto min-h-0 w-full min-w-0 max-w-full overflow-x-hidden bg-white shadow-none",
            displayInputBoxClass,
          )}
          aria-label={ariaLabel}
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={startEdit}
          className={cn(
            "col-start-1 row-start-1 -ml-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-white",
            displayTextClass,
            disabled && "pointer-events-none opacity-50",
          )}
          aria-label={ariaLabel}
        >
          {value || "—"}
        </button>
      )}
    </span>
  );
}
