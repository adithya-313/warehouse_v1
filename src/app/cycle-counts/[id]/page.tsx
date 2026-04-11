"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ClipboardList, Package, Search, Check, AlertTriangle,
  Play, CheckCircle2, Clock, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CycleCount, CycleCountItem, CycleCountStatus, CycleCountProgress } from "@/lib/types";

const statusConfig: Record<CycleCountStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  scheduled:    { label: "Scheduled",    color: "text-blue-400",   bg: "bg-blue-500/15 border-blue-500/30",   icon: Clock },
  "in-progress": { label: "In Progress",  color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/30", icon: Play },
  completed:    { label: "Completed",     color: "text-green-400",  bg: "bg-green-500/15 border-green-500/30",  icon: CheckCircle2 },
};

const VARIANCE_THRESHOLD = 5;

interface CycleCountWithItems extends CycleCount {
  items: CycleCountItem[];
  warehouses?: { id: string; name: string; location: string | null };
}

export default function CycleCountDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [cycleCount, setCycleCount] = useState<CycleCountWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<CycleCountItem | null>(null);
  const [actualQty, setActualQty] = useState("");
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<CycleCountProgress | null>(null);

  const fetchCycleCount = useCallback(async () => {
    const r = await fetch(`/api/cycle-counts/${params.id}`);
    if (r.ok) {
      const data = await r.json();
      setCycleCount(data);
      if (data.status === "in-progress") {
        fetchProgress();
      }
    } else {
      setError("Failed to load cycle count");
    }
    setLoading(false);
  }, [params.id]);

  const fetchProgress = async () => {
    const r = await fetch(`/api/cycle-counts/${params.id}/progress`);
    if (r.ok) {
      const data = await r.json();
      setProgress(data.progress);
    }
  };

  useEffect(() => {
    fetchCycleCount();
  }, [fetchCycleCount]);

  const startCount = async () => {
    setStarting(true);
    setError("");
    try {
      const r = await fetch(`/api/cycle-counts/${params.id}/start`, { method: "POST" });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error || "Failed to start count");
      }
      await fetchCycleCount();
    } catch (err: any) {
      setError(err.message);
    }
    setStarting(false);
  };

  const finalizeCount = async () => {
    setFinalizing(true);
    setError("");
    try {
      const r = await fetch(`/api/cycle-counts/${params.id}/finalize`, { method: "POST" });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error || "Failed to finalize count");
      }
      const data = await r.json();
      alert(`Cycle count finalized!\nFlagged items: ${data.summary.flagged_items}\nDiscrepancies created: ${data.summary.discrepancies_created}`);
      await fetchCycleCount();
    } catch (err: any) {
      setError(err.message);
    }
    setFinalizing(false);
  };

  const recordCount = async (productId: string, qty: number) => {
    setRecording(true);
    setError("");
    try {
      const r = await fetch(`/api/cycle-counts/${params.id}/items/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, actual_qty: qty }),
      });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error || "Failed to record count");
      }
      await fetchCycleCount();
      setSelectedItem(null);
      setActualQty("");
      setSearchQuery("");
    } catch (err: any) {
      setError(err.message);
    }
    setRecording(false);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!cycleCount?.items) return;

    const found = cycleCount.items.find(
      (item) =>
        item.status === "pending" &&
        ((item as any).products?.name.toLowerCase().includes(query.toLowerCase())
        || (item as any).products?.category?.toLowerCase().includes(query.toLowerCase()))
    );
    if (found) {
      setSelectedItem(found);
      setActualQty("");
    }
  };

  const getPreviewVariance = () => {
    if (!selectedItem || actualQty === "") return null;
    const qty = parseFloat(actualQty) || 0;
    const expected = Number(selectedItem.expected_qty);
    const variance = qty - expected;
    const variancePct = expected === 0 ? (qty === 0 ? 0 : 100) : (variance / expected) * 100;
    const flagged = Math.abs(variancePct) > VARIANCE_THRESHOLD;
    return { variance, variancePct, flagged };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!cycleCount) {
    return (
      <div className="card p-12 text-center">
        <p className="text-red-400">Cycle count not found</p>
        <Link href="/cycle-counts" className="text-cyan-400 text-sm mt-2 inline-block">
          Back to Cycle Counts
        </Link>
      </div>
    );
  }

  const status = statusConfig[cycleCount.status];
  const StatusIcon = status.icon;
  const warehouse = (cycleCount as any).warehouses;
  const totalItems = cycleCount.items?.length ?? 0;
  const countedItems = cycleCount.items?.filter((i) => i.status !== "pending").length ?? 0;
  const pendingItems = cycleCount.items?.filter((i) => i.status === "pending").length ?? 0;
  const flaggedItems = cycleCount.items?.filter((i) => i.discrepancy_flag).length ?? 0;
  const progressPct = totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0;
  const canFinalize = cycleCount.status === "in-progress" && pendingItems === 0;

  const previewVariance = getPreviewVariance();

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
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("pill text-xs border", status.bg, status.color)}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {status.label}
              </span>
              <h1 className="text-xl font-bold text-white">
                {warehouse?.name ?? "Unknown Warehouse"}
              </h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {warehouse?.location ?? ""} • {cycleCount.count_type === "full" ? "Full Count" : "Zone-Based"}
              {cycleCount.notes && ` • ${cycleCount.notes}`}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {cycleCount.status !== "scheduled" && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-300">
              Progress ({countedItems}/{totalItems} items)
            </span>
            <span className="text-sm font-bold text-cyan-400">{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex gap-4 mt-3 text-xs text-slate-500">
            <span>Counted: <span className="text-slate-300">{countedItems}</span></span>
            <span>Pending: <span className="text-slate-300">{pendingItems}</span></span>
            <span>Flagged: <span className={flaggedItems > 0 ? "text-red-400" : "text-slate-300"}>{flaggedItems}</span></span>
          </div>
        </div>
      )}

      {cycleCount.status === "scheduled" && (
        <div className="card p-6 text-center">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-white mb-1">Ready to Start</h2>
          <p className="text-sm text-slate-500 mb-4">
            This cycle count has {totalItems === 0 ? "not been started yet" : `${totalItems} items`}.
            Start the count to begin recording quantities.
          </p>
          <button
            onClick={startCount}
            disabled={starting}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-cyan-500/15 text-cyan-400 rounded-lg hover:bg-cyan-500/25 transition text-sm font-medium border border-cyan-500/30 disabled:opacity-50"
          >
            {starting ? (
              <>
                <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start Cycle Count
              </>
            )}
          </button>
        </div>
      )}

      {cycleCount.status === "in-progress" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-4 space-y-4">
            <h2 className="text-sm font-medium text-white flex items-center gap-2">
              <Search className="w-4 h-4 text-cyan-400" />
              Product Search / Barcode Entry
            </h2>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by product name..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition"
              autoFocus
            />

            {selectedItem && (
              <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-medium text-white">
                      {(selectedItem as any).products?.name ?? "Unknown Product"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {(selectedItem as any).products?.category ?? "Uncategorized"} •{" "}
                      {(selectedItem as any).products?.unit ?? "units"}
                    </div>
                  </div>
                  <span className="text-sm text-slate-400">
                    Expected: <span className="font-medium text-white">{selectedItem.expected_qty}</span>
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="number"
                    value={actualQty}
                    onChange={(e) => setActualQty(e.target.value)}
                    placeholder="Enter actual qty"
                    min="0"
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition"
                    autoFocus
                  />
                  <button
                    onClick={() => recordCount(selectedItem.product_id, parseFloat(actualQty) || 0)}
                    disabled={recording || actualQty === ""}
                    className="px-4 py-2 bg-cyan-500/15 text-cyan-400 rounded-lg hover:bg-cyan-500/25 transition text-sm font-medium border border-cyan-500/30 disabled:opacity-50 flex items-center gap-1"
                  >
                    {recording ? (
                      <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Record
                      </>
                    )}
                  </button>
                </div>

                {previewVariance && actualQty !== "" && (
                  <div className="mt-3 p-2 rounded-lg bg-slate-900/50">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Variance Preview:</span>
                      <span className={previewVariance.flagged ? "text-red-400" : "text-green-400"}>
                        {previewVariance.variance >= 0 ? "+" : ""}
                        {previewVariance.variance} units ({previewVariance.variancePct.toFixed(1)}%)
                      </span>
                    </div>
                    {previewVariance.flagged && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-red-400">
                        <AlertTriangle className="w-3 h-3" />
                        Will be flagged for review
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!selectedItem && (
              <div className="text-center py-8 text-slate-500 text-sm">
                <Package className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                Search for a product to record its count
              </div>
            )}
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-medium text-white mb-3">
              Pending Items ({pendingItems})
            </h2>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {cycleCount.items
                ?.filter((item) => item.status === "pending")
                .slice(0, 20)
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedItem(item);
                      setActualQty("");
                      setSearchQuery((item as any).products?.name ?? "");
                    }}
                    className="w-full p-2 text-left rounded-lg bg-slate-800/50 hover:bg-slate-800 transition border border-slate-700/50 hover:border-slate-600"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300 truncate">
                        {(item as any).products?.name ?? "Unknown"}
                      </span>
                      <span className="text-xs text-slate-500">
                        Expected: {item.expected_qty}
                      </span>
                    </div>
                  </button>
                ))}
              {pendingItems > 20 && (
                <p className="text-xs text-slate-600 text-center py-2">
                  +{pendingItems - 20} more items
                </p>
              )}
              {pendingItems === 0 && (
                <p className="text-xs text-slate-600 text-center py-4">
                  All items have been counted
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {cycleCount.status === "in-progress" && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {flaggedItems > 0 && (
              <span className="text-red-400">
                {flaggedItems} items flagged ({">"}5% variance)
              </span>
            )}
          </div>
          <button
            onClick={finalizeCount}
            disabled={!canFinalize || finalizing}
            className={cn(
              "px-6 py-2.5 rounded-lg text-sm font-medium transition flex items-center gap-2",
              canFinalize
                ? "bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25"
                : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
            )}
          >
            {finalizing ? (
              <>
                <div className="w-4 h-4 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
                Finalizing...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Finalize Count
                {!canFinalize && <span className="text-xs text-slate-500">(pending items)</span>}
              </>
            )}
          </button>
        </div>
      )}

      {cycleCount.status === "completed" && (
        <div className="card p-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-white mb-1">Cycle Count Completed</h2>
          <p className="text-sm text-slate-500 mb-4">
            This cycle count has been finalized. View the discrepancies dashboard to review flagged items.
          </p>
          <Link
            href="/discrepancies"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/15 text-amber-400 rounded-lg hover:bg-amber-500/25 transition text-sm font-medium border border-amber-500/30"
          >
            View Discrepancies
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {cycleCount.status === "in-progress" && cycleCount.items && cycleCount.items.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <h2 className="text-sm font-medium text-white">Counted Items</h2>
          </div>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/50 sticky top-0">
                <tr className="text-xs uppercase text-slate-500">
                  <th className="text-left px-4 py-2 font-medium">Product</th>
                  <th className="text-right px-4 py-2 font-medium">Expected</th>
                  <th className="text-right px-4 py-2 font-medium">Actual</th>
                  <th className="text-right px-4 py-2 font-medium">Variance</th>
                  <th className="text-center px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {cycleCount.items
                  .filter((item) => item.status !== "pending")
                  .map((item) => (
                    <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-4 py-2 text-slate-300">
                        {(item as any).products?.name ?? "Unknown"}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-400 tabular-nums">
                        {item.expected_qty}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-200 tabular-nums">
                        {item.actual_qty}
                      </td>
                      <td className={cn(
                        "px-4 py-2 text-right tabular-nums",
                        item.discrepancy_flag ? "text-red-400" : "text-green-400"
                      )}>
                        {item.variance !== null && (
                          <>
                            {Number(item.variance) >= 0 ? "+" : ""}
                            {Number(item.variance).toFixed(1)} ({Number(item.variance_pct).toFixed(1)}%)
                          </>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {item.discrepancy_flag ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/15 text-red-400 border border-red-500/30">
                            <AlertTriangle className="w-3 h-3" />
                            Flagged
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/15 text-green-400 border border-green-500/30">
                            <Check className="w-3 h-3" />
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
