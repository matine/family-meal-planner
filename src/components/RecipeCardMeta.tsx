import { Fragment } from "react";
import type { RecipeCardMetaItem } from "@/lib/recipe-card-meta";
import { cn } from "@/lib/utils";

function MetaCell({ item }: { item: RecipeCardMetaItem }) {
  const Icon = item.icon;
  const isSuccess = item.tone === "success";
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1",
        isSuccess ? "text-success" : "text-muted-foreground",
      )}
    >
      <Icon
        className={cn("h-3 w-3 shrink-0", isSuccess ? "opacity-90" : "opacity-70")}
        aria-hidden
      />
      <span className="truncate">{item.label}</span>
    </span>
  );
}

export function RecipeCardMeta({
  items,
  className,
}: {
  items: RecipeCardMetaItem[];
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <p className={cn("mt-2 text-xs text-muted-foreground", className)}>No ingredients</p>
    );
  }

  return (
    <p className={cn("mt-2 flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs", className)}>
      {items.map((item, index) => (
        <Fragment key={item.key}>
          {index > 0 && (
            <span className="text-muted-foreground/40" aria-hidden>
              |
            </span>
          )}
          <MetaCell item={item} />
        </Fragment>
      ))}
    </p>
  );
}
