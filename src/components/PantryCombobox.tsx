import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PantryLite } from "@/lib/ingredient-match";
import { normalize } from "@/lib/ingredient-match";

export type PantryComboboxProps = {
  pantry: PantryLite[];
  value: string;
  onChange: (name: string, ingredientId?: string) => void;
  placeholder?: string;
  className?: string;
  allowCreate?: boolean;
};

export function PantryCombobox({
  pantry,
  value,
  onChange,
  placeholder = "Pick or type ingredient",
  className,
  allowCreate = true,
}: PantryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matched = useMemo(() => {
    const q = normalize(query || value);
    if (!q) return pantry.slice(0, 50);
    return pantry
      .filter((p) => normalize(p.name).includes(q))
      .slice(0, 50);
  }, [pantry, query, value]);

  const exists = pantry.some((p) => normalize(p.name) === normalize(query));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between font-normal", className)}
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search pantry..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No pantry items.</CommandEmpty>
            <CommandGroup>
              {matched.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.name}
                  onSelect={() => {
                    onChange(p.name, p.id);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === p.name ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.category && <span className="ml-2 text-xs text-muted-foreground">{p.category}</span>}
                </CommandItem>
              ))}
              {allowCreate && query.trim() && !exists && (
                <CommandItem
                  value={`__create__${query}`}
                  onSelect={() => {
                    onChange(query.trim());
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Use "{query.trim()}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
