"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus, Calendar, MapPin, ChevronRight, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CycleCountRow, CycleCountStatus } from "@/lib/types";

const statusConfig: Record<CycleCountStatus, { label: string; color: string; bg: string }> = {
  scheduled:    { label: "Scheduled",    color: "text-blue-400",   bg: "bg-blue-500/15 border-blue-500/30" },
  "in-progress": { label: "In Progress", color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/30" },
  completed:    { label: "Completed",    color: "text-green-400",  bg: "bg-green-500/15 border-green-500/30" },
};

export default function CycleCountsPage() {
  const [counts, setCounts] = useState<CycleCountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CycleCountStatus | "all">("all");

  const fetchCounts = async () => {
    const r = await fetch("/api/cycle-counts");
    if (r.ok) {
      const data = await r.json();
      setCounts(data);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCounts(); }, []);

  const filtered = counts.filter((c) => filter === "all" || c.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-cyan-400" />
            Cycle Counts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Inventory reconciliation through scheduled counting
          </p>
        </div>
        <Link
          href="/cycle-counts/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/15 text-cyan-400 rounded-lg hover:bg-cyan-500/25 transition text-sm font-medium border border-cyan-500/30"
        >
          <Plus className="w-4 h-4" />
          New Cycle Count
        </Link>
      </div>

      <div className="flex gap-2">
        {(["all", "scheduled", "in-progress", "completed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition border",
              filter === s
                ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
            )}
          >
            {s === "all" ? "All" : statusConfig[s].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-500">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <ClipboardList className="w-10 h-10 text-slate-600" />
          <div className="text-white font-medium">No cycle counts found</div>
          <div className="text-sm text-slate-500">
            Start a new cycle count to reconcile inventory
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((cc) => {
            const config = statusConfig[cc.status];
            const warehouse = (cc as any).warehouses;

            return (
              <Link
                key={cc.id}
                href={`/cycle-counts/${cc.id}`}
                className="card p-4 flex items-center gap-4 hover:bg-slate-800/50 transition group"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <Package className="w-5 h-5 text-slate-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("pill text-xs border", config.bg, config.color)}>
                      {config.label}
                    </span>
                    <span className="text-sm font-medium text-white">
                      {warehouse?.name ?? "Unknown Warehouse"}
                    </span>
                    <span className="text-xs text-slate-500 capitalize">({cc.count_type})</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(cc.scheduled_date).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {warehouse?.location ?? "—"}
                    </span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-sm text-slate-300">
                    <span className="font-medium text-white">{cc.counted_items}</span>
                    <span className="text-slate-500">/{cc.total_items}</span>
                    <span className="text-xs text-slate-500 ml-1">counted</span>
                  </div>
                  {cc.flagged_items > 0 && (
                    <div className="text-xs text-red-400 mt-0.5">
                      {cc.flagged_items} flagged
                    </div>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      )}

      <div className="flex justify-end">
        <Link
          href="/discrepancies"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-amber-400 hover:text-amber-300 transition"
        >
          View Discrepancy Dashboard →
        </Link>
      </div>
    </div>
  );
}
