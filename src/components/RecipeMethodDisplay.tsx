import { Fragment } from "react";
import { methodDisplayLines, parseMethodDisplayLine } from "@/lib/recipe-method-format";
import { cn } from "@/lib/utils";

type Props = {
  method: string;
  className?: string;
};

export function RecipeMethodDisplay({ method, className }: Props) {
  const lines = methodDisplayLines(method);
  if (!lines.length) return null;

  return (
    <div
      className={cn(
        "grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-3",
        className,
      )}
    >
      {lines.map((line, i) => {
        const parsed = parseMethodDisplayLine(line);
        if (parsed.type === "numbered") {
          return (
            <Fragment key={i}>
              <span className="pt-px text-right text-sm font-medium tabular-nums text-foreground/75">
                {parsed.label}
              </span>
              <p className="m-0 text-sm leading-relaxed text-foreground/90">{parsed.body}</p>
            </Fragment>
          );
        }
        return (
          <p key={i} className="col-span-2 m-0 text-sm leading-relaxed text-foreground/90">
            {parsed.text}
          </p>
        );
      })}
    </div>
  );
}
