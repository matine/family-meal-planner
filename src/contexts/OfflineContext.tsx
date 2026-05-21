import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { listOutbox } from "@/lib/offline/db";
import { isOnline, subscribeOnlineStatus } from "@/lib/offline/online";
import { syncOfflineData } from "@/lib/offline/sync";

type OfflineContextValue = {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  syncNow: () => Promise<void>;
};

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(() => isOnline());
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPending = useCallback(async () => {
    try {
      const entries = await listOutbox();
      setPendingCount(entries.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!isOnline()) return;
    setSyncing(true);
    try {
      await syncOfflineData();
      await refreshPending();
    } finally {
      setSyncing(false);
    }
  }, [refreshPending]);

  useEffect(() => {
    return subscribeOnlineStatus(setOnline);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    void refreshPending();
    const onChanged = () => void refreshPending();
    window.addEventListener("family-kitchen:offline-data-changed", onChanged);
    return () => window.removeEventListener("family-kitchen:offline-data-changed", onChanged);
  }, [refreshPending]);

  useEffect(() => {
    if (!online) return;
    void syncNow();
  }, [online, syncNow]);

  const value = useMemo(
    () => ({ online, syncing, pendingCount, syncNow }),
    [online, syncing, pendingCount, syncNow],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    return {
      online: isOnline(),
      syncing: false,
      pendingCount: 0,
      syncNow: async () => {},
    };
  }
  return ctx;
}
