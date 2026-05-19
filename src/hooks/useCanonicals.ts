import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CanonicalLite } from "@/lib/canonical";

export function useCanonicals() {
  const [rows, setRows] = useState<CanonicalLite[]>([]);
  const [loading, setLoading] = useState(true);
  // Unique per-mount suffix so concurrent useCanonicals() callers don't share
  // a Supabase realtime channel topic (which would make the second .on()
  // throw "cannot add postgres_changes callbacks after subscribe()").
  const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2, 8));

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("canonical_ingredients")
      .select("id, name, last_category")
      .order("name", { ascending: true });
    setRows((data ?? []) as CanonicalLite[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`rt-canonical_ingredients-${instanceIdRef.current}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "canonical_ingredients" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { rows, loading, refresh };
}
