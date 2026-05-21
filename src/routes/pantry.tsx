import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Carrot,
  Search,
  ChevronDown,
  Tag,
  Settings2,
  ShoppingBasket,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTable, type Ingredient } from "@/hooks/useTable";
import { useCanonicals } from "@/hooks/useCanonicals";
import { useCategories } from "@/hooks/useCategories";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { IngredientPredictiveInput } from "@/components/IngredientPredictiveInput";
import { CategoryManager } from "@/components/CategoryManager";
import { resolveOrCreateCanonical, type CanonicalLite } from "@/lib/canonical";
import { normalize } from "@/lib/ingredient-match";
import { isInPantry } from "@/lib/pantry";
import { cap } from "@/lib/text";
import { useOffline } from "@/contexts/OfflineContext";
import { requireOnline } from "@/lib/offline/require-online";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pantry")({
  component: PantryPage,
  head: () => ({ meta: [{ title: "Pantry — Family Kitchen" }] }),
});

const UNCATEGORIZED = "Uncategorized";

function pantryItemShoppingName(
  item: Ingredient,
  canonicalById: Map<string, CanonicalLite>,
): string {
  return item.canonical_id
    ? (canonicalById.get(item.canonical_id)?.name ?? item.name)
    : item.name;
}

async function insertPantryItemOnShoppingList(
  item: Ingredient,
  canonicalById: Map<string, CanonicalLite>,
) {
  return supabase.from("shopping_list").insert({
    name: pantryItemShoppingName(item, canonicalById),
    canonical_id: item.canonical_id,
  });
}

function PantryPage() {
  const { online } = useOffline();
  const { rows, refresh } = useTable<Ingredient>("ingredients");
  const { rows: canonicals } = useCanonicals();
  const { rows: categories } = useCategories();
  const categoryNames = useMemo(() => categories.map((c) => c.name), [categories]);
  const canonicalById = useMemo(() => {
    const m = new Map<string, CanonicalLite>();
    canonicals.forEach((c) => m.set(c.id, c));
    return m;
  }, [canonicals]);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("");
  const [manageOpen, setManageOpen] = useState(false);

  const applyCategoryFromCanonical = (can: CanonicalLite | undefined) => {
    const last = can?.last_category?.trim();
    if (last && categoryNames.includes(last)) setCategory(last);
  };

  // Keep the selected category valid as the list loads/changes.
  useEffect(() => {
    if (categoryNames.length === 0) {
      if (category !== "") setCategory("");
      return;
    }
    if (!categoryNames.includes(category)) setCategory(categoryNames[0]);
  }, [categoryNames, category]);

  // When the typed name matches a library ingredient, use its remembered category.
  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed || categoryNames.length === 0) return;
    const can = canonicals.find(
      (c) =>
        c.name.toLowerCase() === trimmed.toLowerCase() ||
        normalize(c.name) === normalize(trimmed),
    );
    applyCategoryFromCanonical(can);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to name/canonical list
  }, [name, canonicals, categoryNames]);
  const [search, setSearch] = useState("");
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const highlightTimer = useRef<number | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const displayName = (row: Ingredient): string => {
    const c = row.canonical_id ? canonicalById.get(row.canonical_id) : null;
    return cap(c?.name ?? row.name);
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireOnline()) return;
    if (!name.trim()) return;
    try {
      const can = await resolveOrCreateCanonical(name, canonicals);
      if (!can) return toast.error("Couldn't add — invalid name");
      if (isInPantry(rows, { canonicalId: can.id, name: can.name })) {
        toast.info(`${cap(can.name)} is already in your pantry`);
        return;
      }
      const { error } = await supabase
        .from("ingredients")
        .insert({ name: can.name, canonical_id: can.id, amount: amount.trim() || null, category });
      if (error) return toast.error(error.message);
      if (category) {
        await supabase
          .from("canonical_ingredients")
          .update({ last_category: category })
          .eq("id", can.id);
      }
      setName("");
      setAmount("");
      refresh();
      toast.success(`Added ${cap(can.name)} to pantry`);
    } catch (e: any) {
      toast.error(e?.message ?? "Add failed");
    }
  };

  const [pendingDelete, setPendingDelete] = useState<Ingredient | null>(null);
  const [pendingSendToShopping, setPendingSendToShopping] = useState<Ingredient | null>(null);

  const confirmSendToShopping = async () => {
    if (!requireOnline()) return;
    const item = pendingSendToShopping;
    if (!item) return;
    const { error } = await insertPantryItemOnShoppingList(item, canonicalById);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPendingSendToShopping(null);
    toast.success(`Added ${cap(displayName(item))} to shopping list`);
  };

  const confirmDelete = async (addToShopping: boolean) => {
    if (!requireOnline()) return;
    const item = pendingDelete;
    if (!item) return;
    if (addToShopping) {
      const { error } = await insertPantryItemOnShoppingList(item, canonicalById);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Added to shopping list");
    }
    await supabase.from("ingredients").delete().eq("id", item.id);
    setPendingDelete(null);
    refresh();
  };

  const grouped = useMemo(() => {
    const map = new Map<string, Ingredient[]>();
    for (const cat of categoryNames) map.set(cat, []);
    for (const row of rows) {
      const cat = row.category || UNCATEGORIZED;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(row);
    }
    return map;
  }, [rows, categoryNames]);

  const searchMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as { id: string; name: string; category: string }[];
    const out: { id: string; name: string; category: string }[] = [];
    for (const [cat, items] of grouped.entries()) {
      for (const it of items) {
        const n = displayName(it);
        if (n.toLowerCase().includes(q)) out.push({ id: it.id, name: n, category: cat });
      }
    }
    return out.slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, grouped, canonicalById]);

  const toggleCat = (cat: string) =>
    setOpenCats((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });

  const jumpTo = (id: string, cat: string) => {
    setOpenCats((prev) => new Set(prev).add(cat));
    setSearch("");
    setHighlightId(id);
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    setTimeout(() => {
      const el = itemRefs.current[id];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    highlightTimer.current = window.setTimeout(() => setHighlightId(null), 1800);
  };

  useEffect(
    () => () => {
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    },
    [],
  );

  const totalCount = rows.length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Pantry</h1>
      </header>

      {totalCount > 0 && (
        <div className="relative">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search pantry..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {search && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-md">
              {searchMatches.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
              ) : (
                searchMatches.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => jumpTo(m.id, m.category)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="truncate font-medium">{m.name}</span>
                    <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                      {m.category}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={add}
        className={cn(
          "flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] sm:flex-row sm:flex-wrap",
          !online && "pointer-events-none opacity-50",
        )}
      >
        <IngredientPredictiveInput
          canonicals={canonicals}
          value={name}
          onChange={setName}
          onPick={(c) => applyCategoryFromCanonical(c)}
          placeholder="Ingredient name"
          className="flex-1 sm:min-w-48"
          disabled={!online}
        />
        <Input
          placeholder="Amount (optional)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="sm:w-36"
          disabled={!online}
        />
        <Select value={category || undefined} onValueChange={setCategory} disabled={!online}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder={categoryNames.length ? "Category" : "No categories"} />
          </SelectTrigger>
          <SelectContent>
            {categoryNames.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" className="gap-1.5" disabled={!online}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>

      {totalCount === 0 ? (
        <EmptyPantry />
      ) : (
        <div className="space-y-2">
          {Array.from(grouped.entries()).map(([cat, items]) => {
            if (items.length === 0) return null;
            const isOpen = openCats.has(cat);
            return (
              <section
                key={cat}
                className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)]"
              >
                <button
                  type="button"
                  onClick={() => toggleCat(cat)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50"
                  aria-expanded={isOpen}
                >
                  <span className="font-medium">{cat}</span>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{items.length}</span>
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
                    />
                  </span>
                </button>
                {isOpen && (
                  <ul className="grid gap-2 border-t bg-background/40 p-3 sm:grid-cols-2">
                    {items.map((i) => (
                      <PantryRow
                        key={i.id}
                        item={i}
                        displayName={displayName(i)}
                        categoryNames={categoryNames}
                        onChanged={refresh}
                        onRemove={() => setPendingDelete(i)}
                        onSendToShopping={() => setPendingSendToShopping(i)}
                        registerRef={(el) => {
                          itemRefs.current[i.id] = el;
                        }}
                        highlight={highlightId === i.id}
                        allowEdit={online}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setManageOpen(true)}
          className="gap-1.5"
          aria-label="Manage categories"
        >
          <Settings2 className="h-4 w-4" />
          Manage categories
        </Button>
      </div>
      <CategoryManager open={manageOpen} onOpenChange={setManageOpen} />

      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add "{pendingDelete ? displayName(pendingDelete) : ""}" to shopping list?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Removing from your pantry. Want to add it to the shopping list first?
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => confirmDelete(false)}>
              No, just remove
            </Button>
            <Button onClick={() => confirmDelete(true)}>Yes, add it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendingSendToShopping}
        onOpenChange={(o) => !o && setPendingSendToShopping(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add &ldquo;{pendingSendToShopping ? displayName(pendingSendToShopping) : ""}&rdquo; to
              shopping list?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will add the item to your shopping list. It will stay in your pantry.
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setPendingSendToShopping(null)}>
              Cancel
            </Button>
            <Button onClick={() => void confirmSendToShopping()}>Add to shopping list</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PantryRow({
  item,
  displayName,
  categoryNames,
  onChanged,
  onRemove,
  onSendToShopping,
  registerRef,
  highlight,
  allowEdit,
}: {
  item: Ingredient;
  displayName: string;
  categoryNames: string[];
  onChanged: () => void;
  onRemove: () => void;
  onSendToShopping: () => void;
  registerRef: (el: HTMLLIElement | null) => void;
  highlight: boolean;
  allowEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.amount ?? "");
  const itemCategory = item.category ?? UNCATEGORIZED;

  const save = async () => {
    if (!requireOnline()) {
      setEditing(false);
      return;
    }
    const next = value.trim() || null;
    if (next !== (item.amount ?? null)) {
      const { error } = await supabase
        .from("ingredients")
        .update({ amount: next })
        .eq("id", item.id);
      if (error) {
        toast.error(error.message);
        setValue(item.amount ?? "");
        setEditing(false);
        return;
      }
      onChanged();
    }
    setEditing(false);
  };

  const updateCategory = async (cat: string) => {
    if (!requireOnline()) return;
    const { error } = await supabase
      .from("ingredients")
      .update({ category: cat })
      .eq("id", item.id);
    if (error) toast.error(error.message);
    else {
      if (item.canonical_id) {
        await supabase
          .from("canonical_ingredients")
          .update({ last_category: cat })
          .eq("id", item.canonical_id);
      }
      onChanged();
    }
  };

  return (
    <li
      ref={registerRef}
      className={cn(
        "group flex items-center justify-between rounded-xl border bg-card px-4 py-3 shadow-[var(--shadow-card)] transition hover:border-primary/40",
        highlight && "ring-2 ring-primary",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium leading-tight">{displayName}</p>
        <div className="mt-0.5 flex items-center gap-2">
            {editing ? (
              <Input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    save();
                  }
                  if (e.key === "Escape") {
                    setValue(item.amount ?? "");
                    setEditing(false);
                  }
                }}
                placeholder="Amount"
                className="h-7 w-32 px-2 py-1 text-base md:text-xs"
              />
            ) : (
              <button
                type="button"
                onClick={() => allowEdit && setEditing(true)}
                disabled={!allowEdit}
                className="-ml-1 rounded px-1 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                aria-label={`Edit amount for ${displayName}`}
              >
                {item.amount || <span className="italic opacity-60">add amount</span>}
              </button>
            )}
          </div>
      </div>
      {allowEdit && (
        <div className="flex items-center gap-1">
          <Select value={itemCategory} onValueChange={updateCategory}>
            <SelectTrigger
              aria-label={`Change category for ${displayName}`}
              className="h-8 w-8 justify-center border-none bg-transparent p-0 text-muted-foreground shadow-none hover:bg-muted hover:text-foreground [&>svg:last-child]:hidden"
            >
              <Tag className="h-4 w-4" />
              <span className="sr-only">{itemCategory}</span>
            </SelectTrigger>
            <SelectContent>
              {categoryNames.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={onSendToShopping}
            aria-label={`Add ${displayName} to shopping list`}
            title="Add to shopping list"
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
          >
            <ShoppingBasket className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${displayName}`}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </li>
  );
}

function EmptyPantry() {
  return (
    <div className="rounded-2xl border border-dashed bg-[var(--gradient-warm)] p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Carrot className="h-6 w-6" />
      </div>
      <p className="font-medium">Your pantry is empty</p>
      <p className="text-sm text-muted-foreground">
        Add ingredients above to start tracking what's at home.
      </p>
    </div>
  );
}
