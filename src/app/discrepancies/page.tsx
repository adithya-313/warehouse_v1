"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle, CheckCircle, Filter, Package, Warehouse,
  ArrowLeft, Calendar, ChevronDown, ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { InventoryDiscrepancy, DiscrepancyRootCause, Warehouse as WarehouseType } from "@/lib/types";

const rootCauseConfig: Record<DiscrepancyRootCause, { label: string; color: string; bg: string }> = {
  damage:           { label: "Damage",           color: "text-orange-400", bg: "bg-orange-500/15 border-orange-500/30" },
  shrinkage:        { label: "Shrinkage",        color: "text-red-400",    bg: "bg-red-500/15 border-red-500/30" },
  data_entry_error: { label: "Data Entry Error", color: "text-purple-400", bg: "bg-purple-500/15 border-purple-500/30" },
  supplier_short:   { label: "Supplier Short",   color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/30" },
  other:            { label: "Other",            color: "text-slate-400",  bg: "bg-slate-500/15 border-slate-500/30" },
};

export default function DiscrepanciesPage() {
  const [discrepancies, setDiscrepancies] = useState<InventoryDiscrepancy[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [filterWarehouse, setFilterWarehouse] = useState<string>("all");
  const [filterRootCause, setFilterRootCause] = useState<DiscrepancyRootCause | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/inventory-discrepancies").then((r) => r.json()),
      fetch("/api/warehouses").then((r) => r.json()),
    ]).then(([disc, wh]) => {
      setDiscrepancies(Array.isArray(disc) ? disc : []);
      setWarehouses(Array.isArray(wh) ? wh : []);
    }).finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const open = discrepancies.filter((d) => !d.resolved);
    return {
      total: discrepancies.length,
      open: open.length,
      resolved: discrepancies.length - open.length,
      byRootCause: Object.keys(rootCauseConfig).reduce((acc, cause) => {
        acc[cause] = open.filter((d) => d.root_cause === cause).length;
        return acc;
      }, {} as Record<string, number>),
      totalVarianceUnits: open.reduce((sum, d) => sum + Math.abs(d.variance), 0),
    };
  }, [discrepancies]);

  const filtered = useMemo(() => {
    return discrepancies.filter((d) => {
      if (!showResolved && d.resolved) return false;
      if (filterWarehouse !== "all" && d.warehouse_id !== filterWarehouse) return false;
      if (filterRootCause !== "all" && d.root_cause !== filterRootCause) return false;
      return true;
    });
  }, [discrepancies, showResolved, filterWarehouse, filterRootCause]);

  const resolveDiscrepancy = async (id: string, rootCause?: DiscrepancyRootCause) => {
    setResolving(id);
    try {
      await fetch(`/api/inventory-discrepancies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolved: true,
          resolution_notes: resolutionNotes || "Manually resolved",
          root_cause: rootCause,
        }),
      });
      setDiscrepancies((prev) =>
        prev.map((d) => (d.id === id ? { ...d, resolved: true } : d))
      );
      setExpandedId(null);
      setResolutionNotes("");
    } catch (err) {
      console.error("Failed to resolve discrepancy");
    }
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
    <div className="space-y-6">
      <div>
        <Link
          href="/cycle-counts"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cycle Counts
        </Link>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          Inventory Discrepancies
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review and resolve inventory variances from cycle counts
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card p-4">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-sm text-slate-400">Total Discrepancies</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-red-400">{stats.open}</div>
          <div className="text-sm text-slate-400">Open</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-green-400">{stats.resolved}</div>
          <div className="text-sm text-slate-400">Resolved</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-amber-400">{stats.totalVarianceUnits.toFixed(0)}</div>
          <div className="text-sm text-slate-400">Total Variance Units</div>
        </div>
        <div className="card p-4 flex items-center justify-center gap-4">
          <Filter className="w-5 h-5 text-slate-500" />
          <span className="text-sm text-slate-400">Filter below</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries(stats.byRootCause).map(([cause, count]) => {
          const config = rootCauseConfig[cause as DiscrepancyRootCause];
          return (
            <button
              key={cause}
              onClick={() => setFilterRootCause(filterRootCause === cause ? "all" : cause as DiscrepancyRootCause)}
              className={cn(
                "card p-3 text-center transition border",
                filterRootCause === cause
                  ? `${config.bg} border-current`
                  : "bg-slate-900 border-slate-800 hover:border-slate-700"
              )}
            >
              <div className={cn("text-lg font-bold", config.color)}>{count}</div>
              <div className={cn("text-xs", config.color)}>{config.label}</div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={filterWarehouse}
          onChange={(e) => setFilterWarehouse(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
        >
          <option value="all">All Warehouses</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500/50"
          />
          Show Resolved
        </label>
        {(filterWarehouse !== "all" || filterRootCause !== "all") && (
          <button
            onClick={() => { setFilterWarehouse("all"); setFilterRootCause("all"); }}
            className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition"
          >
            Clear Filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <CheckCircle className="w-10 h-10 text-green-400" />
          <div className="text-white font-medium">No discrepancies found</div>
          <div className="text-sm text-slate-500">
            {stats.open === 0 ? "All inventory variances have been resolved!" : "No items match your filters."}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((disc) => {
            const config = rootCauseConfig[disc.root_cause];
            const product = (disc as any).products;
            const warehouse = (disc as any).warehouses;
            const cc = (disc as any).cycle_counts;
            const isExpanded = expandedId === disc.id;

            return (
              <div
                key={disc.id}
                className={cn(
                  "card overflow-hidden transition",
                  disc.resolved && "opacity-60"
                )}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : disc.id)}
                  className="w-full p-4 flex items-center gap-4 text-left"
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    disc.resolved ? "bg-green-500/15" : "bg-red-500/15"
                  )}>
                    {disc.resolved ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white">
                        {product?.name ?? "Unknown Product"}
                      </span>
                      <span className={cn("pill text-xs border", config.bg, config.color)}>
                        {config.label}
                      </span>
                      {disc.resolved && (
                        <span className="pill text-xs bg-green-500/15 text-green-400 border border-green-500/30">
                          Resolved
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Warehouse className="w-3 h-3" />
                        {warehouse?.name ?? "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(disc.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className={cn(
                      "text-sm font-medium",
                      disc.variance >= 0 ? "text-green-400" : "text-red-400"
                    )}>
                      {disc.variance >= 0 ? "+" : ""}
                      {disc.variance.toFixed(1)} units
                    </div>
                    <div className="text-xs text-slate-500">
                      {disc.variance_pct.toFixed(1)}%
                    </div>
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-800 pt-4 space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Expected Qty</div>
                        <div className="text-slate-300">{disc.expected_qty}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Actual Qty</div>
                        <div className="text-slate-300">{disc.actual_qty}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Cycle Count</div>
                        <div className="text-slate-300">
                          {cc ? new Date(cc.scheduled_date).toLocaleDateString() : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Category</div>
                        <div className="text-slate-300">{product?.category ?? "—"}</div>
                      </div>
                    </div>

                    {disc.resolution_notes && (
                      <div className="p-3 bg-slate-800/50 rounded-lg">
                        <div className="text-xs text-slate-500 mb-1">Resolution Notes</div>
                        <div className="text-sm text-slate-300">{disc.resolution_notes}</div>
                      </div>
                    )}

                    {!disc.resolved && (
                      <div className="space-y-3 pt-2 border-t border-slate-800">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Root Cause</label>
                          <div className="flex flex-wrap gap-2">
                            {(Object.keys(rootCauseConfig) as DiscrepancyRootCause[]).map((cause) => (
                              <button
                                key={cause}
                                onClick={() => resolveDiscrepancy(disc.id, cause)}
                                disabled={resolving === disc.id}
                                className={cn(
                                  "px-2 py-1 text-xs rounded border transition",
                                  disc.root_cause === cause
                                    ? rootCauseConfig[cause].bg + " " + rootCauseConfig[cause].color + " border-current"
                                    : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                                )}
                              >
                                {rootCauseConfig[cause].label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={resolutionNotes}
                            onChange={(e) => setResolutionNotes(e.target.value)}
                            placeholder="Add resolution notes (optional)..."
                            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                          />
                          <button
                            onClick={() => resolveDiscrepancy(disc.id)}
                            disabled={resolving === disc.id}
                            className="px-4 py-2 bg-green-500/15 text-green-400 rounded-lg hover:bg-green-500/25 transition text-sm font-medium border border-green-500/30 disabled:opacity-50"
                          >
                            {resolving === disc.id ? "..." : "Mark Resolved"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
