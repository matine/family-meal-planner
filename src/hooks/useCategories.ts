import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Category = { id: string; name: string; sort_order: number };

export function useCategories() {
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("categories")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true });
    setRows((data ?? []) as Category[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase.channel(`rt-categories-${Math.random().toString(36).slice(2)}`);
    channel
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { rows, loading, refresh };
}
