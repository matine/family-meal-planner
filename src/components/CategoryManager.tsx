import { useEffect, useRef, useState } from "react";
import { Check, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useCategories, type Category } from "@/hooks/useCategories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CategoryManager({ open, onOpenChange }: Props) {
  const { rows, refresh } = useCategories();
  const [items, setItems] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [busy, setBusy] = useState(false);

  // Mirror server state into local list so reordering feels instant.
  useEffect(() => {
    setItems(rows);
  }, [rows]);

  const persistOrder = async (next: Category[]) => {
    setItems(next);
    // Renumber by index*10 to leave gaps for future inserts.
    const updates = next.map((c, i) => ({ id: c.id, sort_order: (i + 1) * 10 }));
    setBusy(true);
    try {
      await Promise.all(
        updates.map((u) =>
          supabase.from("categories").update({ sort_order: u.sort_order }).eq("id", u.id),
        ),
      );
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Reorder failed");
    } finally {
      setBusy(false);
    }
  };

  // Drag and drop reordering -------------------------------------------------
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const lastDropRef = useRef<{ from: string; to: string } | null>(null);

  const onDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    // Firefox needs data set to start the drag.
    e.dataTransfer.setData("text/plain", id);
  };

  const onDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== overId) setOverId(id);
  };

  const onDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = dragId ?? e.dataTransfer.getData("text/plain");
    setDragId(null);
    setOverId(null);
    if (!sourceId || sourceId === targetId) return;
    lastDropRef.current = { from: sourceId, to: targetId };
    const from = items.findIndex((c) => c.id === sourceId);
    const to = items.findIndex((c) => c.id === targetId);
    if (from === -1 || to === -1) return;
    const next = items.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persistOrder(next);
  };

  const onDragEnd = () => {
    setDragId(null);
    setOverId(null);
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const maxOrder = items.length ? Math.max(...items.map((c) => c.sort_order)) : 0;
      const { error } = await supabase
        .from("categories")
        .insert({ name, sort_order: maxOrder + 10 });
      if (error) {
        toast.error(error.message.includes("duplicate") ? "That category already exists." : error.message);
        return;
      }
      setNewName("");
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setEditValue(c.name);
  };

  const saveEdit = async (c: Category) => {
    const next = editValue.trim();
    if (!next || next === c.name) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("categories")
        .update({ name: next })
        .eq("id", c.id);
      if (error) {
        toast.error(error.message.includes("duplicate") ? "That category already exists." : error.message);
        return;
      }
      // Cascade rename onto pantry items currently using the old name.
      await supabase.from("ingredients").update({ category: next }).eq("category", c.name);
      setEditingId(null);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Category) => {
    if (!confirm(`Delete "${c.name}"? Pantry items in this category will become uncategorised.`)) return;
    setBusy(true);
    try {
      // Unlink pantry items first.
      await supabase.from("ingredients").update({ category: null }).eq("category", c.name);
      const { error } = await supabase.from("categories").delete().eq("id", c.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage categories</DialogTitle>
          <DialogDescription>
            Add, rename, reorder, or remove pantry categories. Renames update existing pantry items automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={add} className="flex gap-2">
          <Input
            placeholder="New category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button type="submit" disabled={busy || !newName.trim()} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </form>

        <ul className="max-h-[50vh] divide-y overflow-y-auto rounded-lg border">
          {items.map((c) => (
            <li
              key={c.id}
              draggable={editingId !== c.id}
              onDragStart={(e) => onDragStart(e, c.id)}
              onDragOver={(e) => onDragOver(e, c.id)}
              onDrop={(e) => onDrop(e, c.id)}
              onDragEnd={onDragEnd}
              className={cn(
                "flex items-center gap-2 px-3 py-2 transition",
                dragId === c.id && "opacity-40",
                overId === c.id && dragId && dragId !== c.id && "bg-accent",
                editingId !== c.id && "cursor-grab active:cursor-grabbing",
              )}
            >
              <span
                aria-hidden
                className="text-muted-foreground/60 hover:text-foreground"
              >
                <GripVertical className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                {editingId === c.id ? (
                  <Input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveEdit(c);
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="h-8 text-base md:text-sm"
                  />
                ) : (
                  <span className="truncate text-sm">{c.name}</span>
                )}
              </div>
              {editingId === c.id ? (
                <>
                  <button
                    type="button"
                    onClick={() => saveEdit(c)}
                    aria-label="Save"
                    className="rounded p-1.5 text-success hover:bg-success/10"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    aria-label="Cancel"
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    aria-label={`Rename ${c.name}`}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(c)}
                    aria-label={`Delete ${c.name}`}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No categories yet — add your first above.
            </li>
          )}
        </ul>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
