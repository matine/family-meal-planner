import { CloudOff, Loader2 } from "lucide-react";
import { useOffline } from "@/contexts/OfflineContext";

export function OfflineBanner() {
  const { online, syncing, pendingCount } = useOffline();

  if (online && pendingCount === 0 && !syncing) return null;

  return (
    <div
      className="border-b bg-muted/80 px-3 py-1.5 text-center text-xs text-muted-foreground"
      role="status"
    >
      {!online ? (
        <span className="inline-flex items-center justify-center gap-1.5">
          <CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Offline — shopping ticks save on this device and sync when you&apos;re back online
        </span>
      ) : syncing ? (
        <span className="inline-flex items-center justify-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          Syncing…
        </span>
      ) : pendingCount > 0 ? (
        <span>Syncing {pendingCount} change{pendingCount === 1 ? "" : "s"}…</span>
      ) : null}
    </div>
  );
}
