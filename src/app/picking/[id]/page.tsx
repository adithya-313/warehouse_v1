"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Package, MapPin, Check, CheckCircle2, AlertTriangle,
  Clock, Play, Scan, ChevronRight, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PickBatchWithItems, PickBatchStatus, PickBatchItem } from "@/lib/types";

const statusConfig: Record<PickBatchStatus, { label: string; color: string; bg: string }> = {
  draft:       { label: "Draft",       color: "text-slate-400", bg: "bg-slate-500/15 border-slate-500/30" },
  assigned:    { label: "Assigned",   color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30" },
  "in-progress": { label: "In Progress", color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/30" },
  completed:   { label: "Completed",  color: "text-green-400", bg: "bg-green-500/15 border-green-500/30" },
};

const ZONE_ORDER = ["A", "B", "C", "D", "E", "F"];

export default function PickingDetailPage({ params }: { params: { id: string } }) {
  const [batch, setBatch] = useState<PickBatchWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PickBatchItem | null>(null);
  const [pickedQty, setPickedQty] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [showZoneAlert, setShowZoneAlert] = useState<string | null>(null);
  const [pickerId] = useState("picker-001");

  const fetchBatch = useCallback(async () => {
    const r = await fetch(`/api/pick-batches/${params.id}`);
    if (r.ok) {
      const data = await r.json();
      setBatch(data);
    } else {
      setError("Failed to load batch");
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchBatch(); }, [fetchBatch]);

  const assignBatch = async () => {
    setActionLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/pick-batches/${params.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picker_id: pickerId }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      await fetchBatch();
    } catch (err: any) {
      setError(err.message);
    }
    setActionLoading(false);
  };

  const pickItem = async (itemId: string, qty: number) => {
    setActionLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/pick-batches/${params.id}/items/${itemId}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picked_qty: qty, picker_id: pickerId }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      const updatedItem = await r.json();

      const currentZone = (updatedItem.bin_locations as any)?.zone;
      const nextItem = batch?.items.find(
        (i) => i.status === "pending" && (i.bin_locations as any)?.zone !== currentZone
      );
      if (nextItem) {
        setShowZoneAlert((nextItem.bin_locations as any)?.zone);
        setTimeout(() => setShowZoneAlert(null), 3000);
      }

      await fetchBatch();
      setSelectedItem(null);
      setPickedQty("");
      setBarcodeInput("");
    } catch (err: any) {
      setError(err.message);
    }
    setActionLoading(false);
  };

  const completeBatch = async () => {
    setActionLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/pick-batches/${params.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picker_id: pickerId }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      const data = await r.json();
      alert(`Batch completed!\nEfficiency: ${data.completion_summary.efficiency_score} picks/min`);
      await fetchBatch();
    } catch (err: any) {
      setError(err.message);
    }
    setActionLoading(false);
  };

  const handleBarcodeScan = () => {
    if (!barcodeInput.trim()) return;
    const item = batch?.items.find(
      (i) => i.product_id === barcodeInput || (i.products as any)?.name.toLowerCase().includes(barcodeInput.toLowerCase())
    );
    if (item && item.status === "pending") {
      setSelectedItem(item);
      setPickedQty(String(item.requested_qty));
      setBarcodeInput("");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="card p-12 text-center">
        <p className="text-red-400">Batch not found</p>
        <Link href="/picking" className="text-cyan-400 text-sm mt-2 inline-block">Back to Picking</Link>
      </div>
    );
  }

  const status = statusConfig[batch.status];
  const warehouse = (batch as any).warehouses;
  const totalItems = batch.items?.length ?? 0;
  const pickedItems = batch.items?.filter((i) => i.status === "picked" || i.status === "verified").length ?? 0;
  const pendingItems = batch.items?.filter((i) => i.status === "pending") ?? [];
  const progressPct = totalItems > 0 ? Math.round((pickedItems / totalItems) * 100) : 0;

  const sortedPending = [...pendingItems].sort((a, b) => {
    const zoneA = ZONE_ORDER.indexOf((a.bin_locations as any)?.zone || "Z");
    const zoneB = ZONE_ORDER.indexOf((b.bin_locations as any)?.zone || "Z");
    if (zoneA !== zoneB) return zoneA - zoneB;
    return (a.bin_locations as any)?.aisle.localeCompare((b.bin_locations as any)?.aisle);
  });

  const nextItem = sortedPending[0];
  const currentZone = nextItem ? (nextItem.bin_locations as any)?.zone : null;

  const zones = [...new Set(batch.items.map((i) => (i.bin_locations as any)?.zone).filter(Boolean))].sort(
    (a, b) => ZONE_ORDER.indexOf(a) - ZONE_ORDER.indexOf(b)
  ) as string[];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/picking" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Picking
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("pill text-xs border", status.bg, status.color)}>{status.label}</span>
              <h1 className="text-xl font-bold text-white">Pick Batch</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {warehouse?.name ?? "—"} • {batch.total_items} items
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      {showZoneAlert && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 p-4 rounded-lg bg-cyan-500/90 text-white font-bold animate-pulse flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Moving to Zone {showZoneAlert}
        </div>
      )}

      {batch.status === "draft" && (
        <div className="card p-6 text-center">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-white mb-1">Batch Ready to Assign</h2>
          <p className="text-sm text-slate-500 mb-4">Assign this batch to a picker to start picking.</p>
          <button
            onClick={assignBatch}
            disabled={actionLoading}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-cyan-500/15 text-cyan-400 rounded-lg hover:bg-cyan-500/25 transition text-sm font-medium border border-cyan-500/30 disabled:opacity-50"
          >
            {actionLoading ? "..." : <><Play className="w-4 h-4" /> Assign & Start</>}
          </button>
        </div>
      )}

      {(batch.status === "assigned" || batch.status === "in-progress") && (
        <>
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-300">
                Progress ({pickedItems}/{totalItems} items)
              </span>
              <span className="text-sm font-bold text-cyan-400">{progressPct}%</span>
            </div>
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cyan-500 to-green-500 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="flex gap-4 mt-3 text-xs text-slate-500">
              <span>Picked: <span className="text-green-400">{pickedItems}</span></span>
              <span>Pending: <span className="text-yellow-400">{totalItems - pickedItems}</span></span>
              {zones.map((z) => (
                <span key={z} className={cn(
                  "px-2 py-0.5 rounded",
                  z === currentZone ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-800 text-slate-500"
                )}>
                  Zone {z}
                </span>
              ))}
            </div>
          </div>

          {nextItem && (
            <div className="card p-4 border-cyan-500/30">
              <div className="flex items-center gap-2 mb-3">
                <Scan className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-medium text-cyan-400">Next Pick</span>
                <span className="ml-auto pill text-xs bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  Zone {(nextItem.bin_locations as any)?.zone}
                </span>
              </div>
              <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg mb-4">
                <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center">
                  <Package className="w-6 h-6 text-slate-400" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-white">{(nextItem.products as any)?.name ?? "—"}</div>
                  <div className="text-xs text-slate-500">{(nextItem.products as any)?.category ?? "—"}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-cyan-400">{nextItem.requested_qty}</div>
                  <div className="text-xs text-slate-500">units needed</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
                <MapPin className="w-4 h-4" />
                <span>
                  Aisle {(nextItem.bin_locations as any)?.aisle}, Rack {(nextItem.bin_locations as any)?.rack}, Bin {(nextItem.bin_locations as any)?.bin}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedItem(nextItem);
                  setPickedQty(String(nextItem.requested_qty));
                }}
                className="w-full px-4 py-2 bg-cyan-500/15 text-cyan-400 rounded-lg hover:bg-cyan-500/25 transition text-sm font-medium border border-cyan-500/30"
              >
                Pick This Item
              </button>
            </div>
          )}

          {selectedItem && (
            <div className="card p-4 space-y-4">
              <h3 className="text-sm font-medium text-white">Record Pick</h3>
              <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg">
                <Package className="w-4 h-4 text-slate-400" />
                <span className="text-slate-200">{(selectedItem.products as any)?.name}</span>
                <span className="ml-auto text-slate-500">Expected: {selectedItem.requested_qty}</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={pickedQty}
                  onChange={(e) => setPickedQty(e.target.value)}
                  placeholder="Quantity picked"
                  min="0"
                  max={selectedItem.requested_qty}
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  onClick={() => pickItem(selectedItem.id, parseFloat(pickedQty) || 0)}
                  disabled={actionLoading || pickedQty === ""}
                  className="px-6 py-2 bg-green-500/15 text-green-400 rounded-lg hover:bg-green-500/25 transition text-sm font-medium border border-green-500/30 disabled:opacity-50"
                >
                  {actionLoading ? "..." : <><Check className="w-4 h-4 inline mr-1" /> Confirm</>}
                </button>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-sm text-slate-500 hover:text-slate-300">
                Cancel
              </button>
            </div>
          )}

          <div className="card p-4">
            <h3 className="text-sm font-medium text-white mb-3">Barcode Scan</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleBarcodeScan()}
                placeholder="Scan or type product ID..."
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
              />
              <button
                onClick={handleBarcodeScan}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition text-sm border border-slate-700"
              >
                <Scan className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={completeBatch}
              disabled={pendingItems.length > 0 || actionLoading}
              className={cn(
                "flex-1 px-6 py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2",
                pendingItems.length === 0
                  ? "bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25"
                  : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
              )}
            >
              <CheckCircle2 className="w-4 h-4" />
              Complete Batch
            </button>
          </div>
        </>
      )}

      {batch.status === "completed" && (
        <div className="card p-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-white mb-1">Batch Completed</h2>
          <p className="text-sm text-slate-500 mb-4">
            {pickedItems} items picked • Efficiency: {batch.efficiency_score?.toFixed(1) ?? "—"} picks/min
          </p>
          <Link href="/picking" className="inline-flex items-center gap-2 px-4 py-2 text-cyan-400 hover:text-cyan-300 transition">
            <ChevronRight className="w-4 h-4" />
            Back to Picking
          </Link>
        </div>
      )}

      {batch.items && batch.items.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800">
            <h2 className="text-sm font-medium text-white">All Items</h2>
          </div>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/50 sticky top-0">
                <tr className="text-xs uppercase text-slate-500">
                  <th className="text-left px-4 py-2 font-medium">#</th>
                  <th className="text-left px-4 py-2 font-medium">Product</th>
                  <th className="text-left px-4 py-2 font-medium">Location</th>
                  <th className="text-right px-4 py-2 font-medium">Qty</th>
                  <th className="text-center px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {batch.items.map((item, idx) => (
                  <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-2 text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-2 text-slate-200">{(item.products as any)?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-400 text-xs">
                      {(item.bin_locations as any)?.zone}/{(item.bin_locations as any)?.aisle}/{(item.bin_locations as any)?.rack}/{(item.bin_locations as any)?.bin}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <span className="text-green-400">{item.picked_qty}</span>
                      <span className="text-slate-500">/{item.requested_qty}</span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={cn(
                        "pill text-xs",
                        item.status === "picked" ? "bg-green-500/15 text-green-400 border border-green-500/30" :
                        item.status === "verified" ? "bg-blue-500/15 text-blue-400 border border-blue-500/30" :
                        "bg-slate-500/15 text-slate-400 border border-slate-500/30"
                      )}>
                        {item.status}
                      </span>
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
