import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CanonicalLite } from "@/lib/canonical";
import {
  OFFLINE_DATA_CHANGED,
  readTableCache,
  replaceTableCache,
  type OfflineDataChangedDetail,
} from "@/lib/offline/db";
import { isOnline } from "@/lib/offline/online";

export function useCanonicals() {
  const [rows, setRows] = useState<CanonicalLite[]>([]);
  const [loading, setLoading] = useState(true);
  const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2, 8));

  const loadFromCache = useCallback(async () => {
    const cached = await readTableCache<CanonicalLite>("canonical_ingredients");
    setRows(cached);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }

    if (!isOnline()) {
      await loadFromCache();
      return;
    }

    try {
      const { data, error } = await supabase
        .from("canonical_ingredients")
        .select("id, name, last_category")
        .order("name", { ascending: true });
      if (error) throw error;
      const next = (data ?? []) as CanonicalLite[];
      await replaceTableCache("canonical_ingredients", next);
      setRows(next);
    } catch {
      await loadFromCache();
    } finally {
      setLoading(false);
    }
  }, [loadFromCache]);

  useEffect(() => {
    void refresh();

    const onOfflineChange = (event: Event) => {
      const detail = (event as CustomEvent<OfflineDataChangedDetail>).detail;
      if (detail?.table && detail.table !== "canonical_ingredients") return;
      void refresh();
    };
    window.addEventListener(OFFLINE_DATA_CHANGED, onOfflineChange);
    window.addEventListener("online", onOfflineChange);
    window.addEventListener("offline", onOfflineChange);

    let channel: ReturnType<typeof supabase.channel> | undefined;
    if (isOnline()) {
      channel = supabase
        .channel(`rt-canonical_ingredients-${instanceIdRef.current}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "canonical_ingredients" },
          () => refresh(),
        )
        .subscribe();
    }

    return () => {
      window.removeEventListener(OFFLINE_DATA_CHANGED, onOfflineChange);
      window.removeEventListener("online", onOfflineChange);
      window.removeEventListener("offline", onOfflineChange);
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { rows, loading, refresh };
}
