"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Clock, AlertTriangle } from "lucide-react";
import { formatTimeAgo } from "@/lib/utils";
import type { SyncStatus } from "@/lib/types";

interface SyncInfo {
  last_synced_at: string | null;
  status: SyncStatus | null;
}

export default function Topbar() {
  const [sync, setSync]       = useState<SyncInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSync = async () => {
    try {
      const r = await fetch("/api/sync/status");
      if (r.ok) setSync(await r.json());
    } catch {}
  };

  useEffect(() => { fetchSync(); }, []);

  const triggerSync = async () => {
    setLoading(true);
    try {
      await fetch("/api/sync/trigger", { method: "POST" });
      setTimeout(fetchSync, 2000);
    } finally {
      setTimeout(() => setLoading(false), 2000);
    }
  };

  return (
    <header className="h-14 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Clock className="w-3.5 h-3.5" />
        <span>
          Last sync:{" "}
          <span className={sync?.status === "failed" ? "text-red-400" : "text-slate-200"}>
            {sync?.last_synced_at ? formatTimeAgo(sync.last_synced_at) : "Never"}
          </span>
          {sync?.status === "failed" && (
            <span className="ml-2 inline-flex items-center gap-1 text-red-400">
              <AlertTriangle className="w-3 h-3" />
              sync failed
            </span>
          )}
        </span>
      </div>

      <button
        onClick={triggerSync}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition-all disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Syncing…" : "Sync Now"}
      </button>
    </header>
  );
}
