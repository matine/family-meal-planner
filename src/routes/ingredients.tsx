import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sprout, Trash2, Search, ArrowRightLeft, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCanonicals } from "@/hooks/useCanonicals";
import { useTable, type Ingredient, type Recipe, type RecipeIngredient, type ShoppingItem } from "@/hooks/useTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cap } from "@/lib/text";
import { ingredientCanonicalIds, packCanonicalRefs } from "@/lib/recipe-ingredient";
import { normalize } from "@/lib/ingredient-match";
import { toast } from "sonner";
import type { CanonicalLite } from "@/lib/canonical";

export const Route = createFileRoute("/ingredients")({
  component: IngredientsPage,
  head: () => ({
    meta: [
      { title: "Ingredients library — Family Kitchen" },
      { name: "description", content: "The single source of truth for ingredient names." },
    ],
  }),
});

type Usage = { pantry: number; shopping: number; recipes: number; total: number };

function IngredientsPage() {
  const { rows: canonicals, refresh } = useCanonicals();
  const { rows: pantry } = useTable<Ingredient>("ingredients");
  const { rows: shopping } = useTable<ShoppingItem>("shopping_list");
  const { rows: recipes } = useTable<Recipe>("recipes");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<CanonicalLite | null>(null);

  const usage = useMemo(() => {
    const m = new Map<string, Usage>();
    const ensure = (id: string) => {
      const u = m.get(id) ?? { pantry: 0, shopping: 0, recipes: 0, total: 0 };
      m.set(id, u);
      return u;
    };
    pantry.forEach((p) => p.canonical_id && (ensure(p.canonical_id).pantry++));
    shopping.forEach((s) => s.canonical_id && (ensure(s.canonical_id).shopping++));
    recipes.forEach((r) => {
      const ings = (r.ingredients as RecipeIngredient[] | null) ?? [];
      const seen = new Set<string>();
      ings.forEach((i) => {
        const ids = ingredientCanonicalIds(i);
        ids.forEach((id) => {
          if (!seen.has(id)) {
            seen.add(id);
            ensure(id).recipes++;
          }
        });
      });
    });
    for (const u of m.values()) u.total = u.pantry + u.shopping + u.recipes;
    return m;
  }, [pantry, shopping, recipes]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    if (!q) return canonicals;
    return canonicals.filter((c) => normalize(c.name).includes(q));
  }, [canonicals, search]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Ingredients library</h1>
        <p className="text-muted-foreground">
          The source of truth for ingredient names. Renaming here updates the pantry, shopping list, and every recipe.
        </p>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search ingredients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {canonicals.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-[var(--gradient-warm)] p-10 text-center">
          <Sprout className="mx-auto mb-3 h-10 w-10 text-primary" />
          <p className="font-medium">No ingredients yet</p>
          <p className="text-sm text-muted-foreground">Add a pantry item, shopping item, or recipe to populate this list.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card shadow-[var(--shadow-card)]">
          {filtered.map((c) => (
            <CanonicalRow
              key={c.id}
              canonical={c}
              usage={usage.get(c.id)}
              onChanged={refresh}
              onAskDelete={() => setConfirmDelete(c)}
            />
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">No matches.</li>
          )}
        </ul>
      )}

      <DeleteRemapDialog
        canonical={confirmDelete}
        canonicals={canonicals}
        usage={confirmDelete ? usage.get(confirmDelete.id) : undefined}
        onClose={() => setConfirmDelete(null)}
        onDone={refresh}
      />
    </div>
  );
}

function CanonicalRow({
  canonical,
  usage,
  onChanged,
  onAskDelete,
}: {
  canonical: CanonicalLite;
  usage?: Usage;
  onChanged: () => void;
  onAskDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(cap(canonical.name));

  const save = async () => {
    const next = value.replace(/\s+$/, "").toLowerCase();
    if (!next) { setValue(cap(canonical.name)); setEditing(false); return; }
    if (next === canonical.name.toLowerCase()) { setEditing(false); return; }
    const { error } = await supabase
      .from("canonical_ingredients")
      .update({ name: next })
      .eq("id", canonical.id);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Another ingredient already has that name." : error.message);
      setValue(cap(canonical.name));
      setEditing(false);
      return;
    }
    toast.success("Renamed everywhere");
    setEditing(false);
    onChanged();
  };

  return (
    <li className="group flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); save(); }
              if (e.key === "Escape") { setValue(cap(canonical.name)); setEditing(false); }
            }}
            className="h-8 text-base md:text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="-ml-1 inline-flex items-center gap-1.5 rounded px-1 text-left font-medium hover:bg-muted"
          >
            {cap(canonical.name)}
            <Pencil className="h-3 w-3 opacity-0 transition group-hover:opacity-60" />
          </button>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {usage && usage.total > 0 ? (
            <>
              Used in {usage.pantry > 0 && `${usage.pantry} pantry`}
              {usage.pantry > 0 && (usage.shopping > 0 || usage.recipes > 0) && ", "}
              {usage.shopping > 0 && `${usage.shopping} shopping`}
              {usage.shopping > 0 && usage.recipes > 0 && ", "}
              {usage.recipes > 0 && `${usage.recipes} recipe${usage.recipes === 1 ? "" : "s"}`}
            </>
          ) : (
            <span className="italic opacity-70">Not used yet</span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onAskDelete}
        aria-label={`Delete ${canonical.name}`}
        className="rounded p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function DeleteRemapDialog({
  canonical,
  canonicals,
  usage,
  onClose,
  onDone,
}: {
  canonical: CanonicalLite | null;
  canonicals: CanonicalLite[];
  usage?: Usage;
  onClose: () => void;
  onDone: () => void;
}) {
  const [target, setTarget] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const others = canonicals.filter((c) => c.id !== canonical?.id);
  const hasUsage = (usage?.total ?? 0) > 0;

  const remapAndDelete = async () => {
    if (!canonical) return;
    setBusy(true);
    try {
      if (target) {
        // Repoint pantry + shopping
        await supabase.from("ingredients").update({ canonical_id: target }).eq("canonical_id", canonical.id);
        await supabase.from("shopping_list").update({ canonical_id: target }).eq("canonical_id", canonical.id);
        // Repoint recipes jsonb (read-modify-write)
        const { data: recs } = await supabase.from("recipes").select("id, ingredients");
        for (const r of recs ?? []) {
          const arr = (r.ingredients as RecipeIngredient[] | null) ?? [];
          let changed = false;
          const next = arr.map((i) => {
            const ids = ingredientCanonicalIds(i);
            if (!ids.includes(canonical.id)) return i;
            changed = true;
            const remapped = [...new Set(ids.map((id) => (id === canonical.id ? target : id)))];
            return { ...i, ...packCanonicalRefs(remapped) };
          });
          if (changed) await supabase.from("recipes").update({ ingredients: next as any }).eq("id", r.id);
        }
        // Save the alias so future imports map automatically
        await supabase.from("ingredient_aliases").upsert(
          { alias: canonical.name, ingredient_id: target },
          { onConflict: "alias" },
        );
      }
      const { error } = await supabase.from("canonical_ingredients").delete().eq("id", canonical.id);
      if (error) throw new Error(error.message);
      toast.success(target ? "Remapped & deleted" : "Deleted");
      onDone();
      onClose();
      setTarget("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!canonical} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete "{cap(canonical?.name ?? "")}"</DialogTitle>
        </DialogHeader>
        {hasUsage ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This ingredient is used in {usage?.pantry ?? 0} pantry, {usage?.shopping ?? 0} shopping, and {usage?.recipes ?? 0} recipe{usage?.recipes === 1 ? "" : "s"}.
              Optionally map all of those references to another ingredient first.
            </p>
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Map to another ingredient (optional)" /></SelectTrigger>
                <SelectContent>
                  {others.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{cap(c.name)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!target && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Without a mapping, references will be unlinked but the items will keep their current name text.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">This ingredient isn't used anywhere yet.</p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={remapAndDelete} disabled={busy}>
            {target ? "Remap & delete" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
