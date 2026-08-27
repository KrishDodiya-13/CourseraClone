"use client";

import * as React from "react";
import { CloudOff, RefreshCw, WifiOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { countPendingProgress } from "@/offline/db";
import { drainOutbox, startSyncListeners } from "@/offline/sync";

interface OfflineContextValue {
  online: boolean;
  pendingCount: number;
  refreshPending: () => void;
  syncNow: () => void;
}

const OfflineContext = React.createContext<OfflineContextValue | null>(null);

/**
 * Connectivity state and the sync queue, app-wide.
 *
 * `navigator.onLine` is the starting point, not the truth — it reports whether
 * a network interface exists, which is not the same as reachable. The queue
 * therefore also drains on tab focus, and a failed drain simply leaves entries
 * queued rather than discarding them.
 *
 * Registers the service worker too, after load, so it never competes with the
 * initial render for bandwidth.
 */
function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = React.useState(true);
  const [pendingCount, setPendingCount] = React.useState(0);

  const refreshPending = React.useCallback(() => {
    void countPendingProgress()
      .then(setPendingCount)
      .catch(() => setPendingCount(0));
  }, []);

  const syncNow = React.useCallback(() => {
    void drainOutbox().then((outcome) => {
      refreshPending();
      if (outcome.synced > 0) {
        toast.success(`Synced ${outcome.synced} update${outcome.synced === 1 ? "" : "s"}`);
      }
    });
  }, [refreshPending]);

  React.useEffect(() => {
    setOnline(navigator.onLine);
    refreshPending();

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const stopSync = startSyncListeners((outcome) => {
      refreshPending();
      if (outcome.synced > 0) {
        toast.success(`Synced ${outcome.synced} update${outcome.synced === 1 ? "" : "s"}`, {
          description: "Your offline progress is now saved to your account.",
        });
      }
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      stopSync();
    };
  }, [refreshPending]);

  // --- service worker ----------------------------------------------------
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") return;

    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failing is not fatal — the app works online without it.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  const value = React.useMemo<OfflineContextValue>(
    () => ({ online, pendingCount, refreshPending, syncNow }),
    [online, pendingCount, refreshPending, syncNow],
  );

  return (
    <OfflineContext.Provider value={value}>
      {children}
      <OfflineIndicator />
    </OfflineContext.Provider>
  );
}

function useOffline(): OfflineContextValue {
  const context = React.useContext(OfflineContext);
  if (!context) throw new Error("useOffline must be used inside an OfflineProvider.");
  return context;
}

/**
 * Persistent connectivity banner.
 *
 * Shown only when offline, or when there is queued work waiting — a banner
 * that is always present stops being read.
 */
function OfflineIndicator() {
  const { online, pendingCount, syncNow } = useOffline();

  if (online && pendingCount === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-center gap-3 px-4 py-2.5 text-sm shadow-lg",
        online ? "bg-warning-subtle text-warning-foreground" : "bg-foreground text-background",
      )}
    >
      {online ? (
        <>
          <CloudOff className="size-4 shrink-0" aria-hidden="true" />
          <span data-numeric>
            {pendingCount} progress update{pendingCount === 1 ? "" : "s"} waiting to sync
          </span>
          <button
            type="button"
            onClick={syncNow}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium underline underline-offset-2"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Sync now
          </button>
        </>
      ) : (
        <>
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
          <span>You are offline. Downloaded lessons still work — videos need a connection.</span>
          {pendingCount > 0 ? (
            <span className="opacity-80" data-numeric>
              · {pendingCount} update{pendingCount === 1 ? "" : "s"} queued
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}

export { OfflineProvider, useOffline, OfflineIndicator };
