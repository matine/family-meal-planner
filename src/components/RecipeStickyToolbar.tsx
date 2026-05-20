import { Check, Loader2, X } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Matches AppNav `h-14` (3.5rem). */
export const APP_NAV_STICKY_OFFSET_PX = 56;

export function RecipeStickyToolbar({
  active,
  onCancel,
  onSave,
  saving,
  saveDisabled,
  saveDisabledTitle,
  cancelLabel = "Cancel editing",
  saveLabel = "Save changes",
}: {
  active: boolean;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  saveDisabled?: boolean;
  saveDisabledTitle?: string;
  cancelLabel?: string;
  saveLabel?: string;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);

  useLayoutEffect(() => {
    if (!active) {
      setPinned(false);
      return;
    }
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setPinned(!entry.isIntersecting),
      {
        root: null,
        rootMargin: `-${APP_NAV_STICKY_OFFSET_PX}px 0px 0px 0px`,
        threshold: 0,
      },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [active]);

  if (!active) return null;

  return (
    <>
      <div ref={sentinelRef} className="h-px w-full shrink-0" aria-hidden />
      {pinned && <div className="h-11 shrink-0" aria-hidden />}
      <div
        className={cn(
          pinned &&
            "fixed inset-x-0 top-14 z-30 border-b border-border bg-background/95 shadow-sm backdrop-blur-md",
        )}
      >
        <div
          className={cn(
            "flex justify-end gap-2 py-2",
            pinned && "mx-auto w-full max-w-5xl px-3",
          )}
          role="toolbar"
          aria-label="Recipe edits"
        >
          <Button
            variant="outline"
            size="icon"
            onClick={onCancel}
            disabled={saving}
            aria-label={cancelLabel}
          >
            <X className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            onClick={onSave}
            disabled={saving || saveDisabled}
            aria-label={saving ? "Saving…" : saveLabel}
            title={saveDisabled ? saveDisabledTitle : undefined}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </>
  );
}

export function RecipePageActions({
  backLink,
  toolbar,
}: {
  backLink: ReactNode;
  toolbar?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {backLink}
      {toolbar}
    </div>
  );
}
