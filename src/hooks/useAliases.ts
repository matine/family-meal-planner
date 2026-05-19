import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AliasMap } from "@/lib/ingredient-match";
import { normalize } from "@/lib/ingredient-match";

export function useAliases() {
  const [aliases, setAliases] = useState<AliasMap>({});

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("ingredient_aliases").select("alias, ingredient_id");
    const map: AliasMap = {};
    for (const row of data ?? []) {
      map[normalize(row.alias)] = row.ingredient_id;
    }
    setAliases(map);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { aliases, refresh };
}

export async function rememberAlias(alias: string, ingredientId: string) {
  const norm = normalize(alias);
  if (!norm) return;
  await supabase.from("ingredient_aliases").upsert({ alias: norm, ingredient_id: ingredientId }, { onConflict: "alias" });
}
