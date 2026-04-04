"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Info, Zap } from "lucide-react";
import { cn, severityColor, formatTimeAgo } from "@/lib/utils";
import type { Alert, AlertSeverity } from "@/lib/types";

const severityIcon = {
  critical: AlertTriangle,
  warning:  Zap,
  info:     Info,
};

const severityOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

export default function AlertsPage() {
  const [alerts,  setAlerts]  = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchAlerts = async () => {
    const r = await fetch("/api/alerts");
    if (r.ok) {
      const data: Alert[] = await r.json();
      data.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
      setAlerts(data);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAlerts(); }, []);

  const resolve = async (id: string) => {
    setResolving(id);
    await fetch("/api/alerts", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id }),
    });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    setResolving(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Active Alerts</h1>
        <p className="text-sm text-slate-500 mt-1">
          {alerts.length} unresolved alert{alerts.length !== 1 ? "s" : ""} — sorted by severity
        </p>
      </div>

      {alerts.length === 0 && (
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <CheckCircle className="w-10 h-10 text-green-400" />
          <div className="text-white font-medium">All clear!</div>
          <div className="text-sm text-slate-500">No active alerts at this time.</div>
        </div>
      )}

      <div className="space-y-3">
        {alerts.map((alert) => {
          const Icon    = severityIcon[alert.severity];
          const colors  = severityColor(alert.severity);
          const product = (alert as any).products;
          const actions = (alert as any).actions ?? [];

          return (
            <div
              key={alert.id}
              className={cn(
                "card p-4 flex gap-4 items-start",
                alert.severity === "critical" && "border-red-500/30"
              )}
            >
              {/* Icon */}
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", colors)}>
                <Icon className="w-4 h-4" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("pill text-xs", colors)}>
                    {alert.severity.toUpperCase()}
                  </span>
                  {product && (
                    <span className="text-sm font-semibold text-white">{product.name}</span>
                  )}
                  <span className="text-xs text-slate-600 ml-auto">{formatTimeAgo(alert.created_at)}</span>
                </div>

                <p className="text-sm text-slate-300 mt-1.5">{alert.message}</p>

                {actions.length > 0 && (
                  <div className="mt-2 p-2.5 bg-slate-800/60 rounded-lg border border-slate-700">
                    <div className="text-xs text-slate-500 mb-1 font-medium uppercase tracking-wider">
                      Recommended Action
                    </div>
                    <p className="text-xs text-slate-300">{actions[0].recommendation}</p>
                  </div>
                )}
              </div>

              {/* Resolve button */}
              <button
                onClick={() => resolve(alert.id)}
                disabled={resolving === alert.id}
                className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-green-500/15 hover:text-green-400 hover:border-green-500/30 transition-all disabled:opacity-50"
              >
                {resolving === alert.id ? "…" : "Resolve"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
