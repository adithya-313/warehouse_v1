"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, ClipboardList, Plus, Calendar, User, ChevronRight, Clock, CheckCircle2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PickBatchRow, PickBatchStatus, Warehouse } from "@/lib/types";

const statusConfig: Record<PickBatchStatus, { label: string; color: string; bg: string }> = {
  draft:       { label: "Draft",       color: "text-slate-400", bg: "bg-slate-500/15 border-slate-500/30" },
  assigned:    { label: "Assigned",   color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30" },
  "in-progress": { label: "In Progress", color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/30" },
  completed:   { label: "Completed",  color: "text-green-400", bg: "bg-green-500/15 border-green-500/30" },
};

type Tab = "active" | "history";

export default function PickingPage() {
  const [batches, setBatches] = useState<PickBatchRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("active");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");

  const fetchData = async () => {
    setLoading(true);
    const [batchesRes, warehousesRes] = await Promise.all([
      fetch("/api/pick-batches").then((r) => r.json()),
      fetch("/api/warehouses").then((r) => r.json()),
    ]);
    setBatches(Array.isArray(batchesRes) ? batchesRes : []);
    setWarehouses(Array.isArray(warehousesRes) ? warehousesRes : []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = batches.filter((b) => {
    if (warehouseFilter !== "all" && b.warehouse_id !== warehouseFilter) return false;
    if (activeTab === "active") return b.status === "draft" || b.status === "assigned" || b.status === "in-progress";
    return b.status === "completed";
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-cyan-400" />
            Picking
          </h1>
          <p className="text-sm text-slate-500 mt-1">Zone-batched picking with route optimization</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/warehouse-layout"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition"
          >
            <Package className="w-4 h-4" />
            Layout
          </Link>
          <Link
            href="/picking/performance"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition"
          >
            <TrendingUp className="w-4 h-4" />
            Performance
          </Link>
          <Link
            href="/picking/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/15 text-cyan-400 rounded-lg hover:bg-cyan-500/25 transition text-sm font-medium border border-cyan-500/30"
          >
            <Plus className="w-4 h-4" />
            New Batch
          </Link>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("active")}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition",
            activeTab === "active" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
          )}
        >
          Active
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={cn(
            "px-4 py-2 rounded-md text-sm font-medium transition",
            activeTab === "history" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
          )}
        >
          History
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
        >
          <option value="all">All Warehouses</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-500">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <ClipboardList className="w-10 h-10 text-slate-600" />
          <div className="text-white font-medium">No {activeTab === "active" ? "active" : "completed"} batches</div>
          <div className="text-sm text-slate-500">
            {activeTab === "active" ? "Create a new batch to start picking" : "Completed batches will appear here"}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((batch) => {
            const config = statusConfig[batch.status];
            const warehouse = (batch as any).warehouses;

            return (
              <Link
                key={batch.id}
                href={`/picking/${batch.id}`}
                className="card p-4 flex items-center gap-4 hover:bg-slate-800/50 transition group"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-5 h-5 text-slate-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("pill text-xs border", config.bg, config.color)}>{config.label}</span>
                    {batch.current_zone && (
                      <span className="pill text-xs bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                        Zone {batch.current_zone}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {warehouse?.name ?? "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(batch.created_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-sm text-slate-300">
                    <span className="font-medium text-white">{batch.picked_count}</span>
                    <span className="text-slate-500">/{batch.total_items}</span>
                    <span className="text-xs text-slate-500 ml-1">picked</span>
                  </div>
                  {batch.efficiency_score !== null && (
                    <div className="text-xs text-green-400 mt-0.5 flex items-center gap-1 justify-end">
                      <TrendingUp className="w-3 h-3" />
                      {batch.efficiency_score.toFixed(1)} picks/min
                    </div>
                  )}
                </div>

                <div className="w-24">
                  <div className="flex items-center justify-end mb-1">
                    <span className="text-xs text-slate-500">{batch.progress_pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all",
                        batch.status === "completed" ? "bg-green-500" : "bg-cyan-500"
                      )}
                      style={{ width: `${batch.progress_pct}%` }}
                    />
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
