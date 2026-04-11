"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Plus, Calendar, MapPin, Package, ChevronRight, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TransferRow, TransferStatus, Warehouse } from "@/lib/types";

const statusConfig: Record<TransferStatus, { label: string; color: string; bg: string }> = {
  draft:      { label: "Draft",      color: "text-slate-400", bg: "bg-slate-500/15 border-slate-500/30" },
  approved:   { label: "Approved",   color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30" },
  "in-transit": { label: "In Transit", color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/30" },
  received:   { label: "Received",   color: "text-green-400", bg: "bg-green-500/15 border-green-500/30" },
  cancelled:  { label: "Cancelled",   color: "text-red-400",  bg: "bg-red-500/15 border-red-500/30" },
};

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TransferStatus | "all">("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");

  const fetchData = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (warehouseFilter !== "all") params.set("from_warehouse_id", warehouseFilter);

    const [transfersRes, warehousesRes] = await Promise.all([
      fetch(`/api/transfers?${params.toString()}`).then((r) => r.json()),
      fetch("/api/warehouses").then((r) => r.json()),
    ]);

    setTransfers(Array.isArray(transfersRes) ? transfersRes : []);
    setWarehouses(Array.isArray(warehousesRes) ? warehousesRes : []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [statusFilter, warehouseFilter]);

  const filtered = transfers;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
            Transfers
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Move inventory between warehouses
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/stock-levels/reserved"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition"
          >
            <Package className="w-4 h-4" />
            Reserved Stock
          </Link>
          <Link
            href="/transfers/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/15 text-cyan-400 rounded-lg hover:bg-cyan-500/25 transition text-sm font-medium border border-cyan-500/30"
          >
            <Plus className="w-4 h-4" />
            New Transfer
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-sm text-slate-400">Filter:</span>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TransferStatus | "all")}
          className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
        >
          <option value="all">All Status</option>
          {Object.entries(statusConfig).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
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
          <ArrowRightLeft className="w-10 h-10 text-slate-600" />
          <div className="text-white font-medium">No transfers found</div>
          <div className="text-sm text-slate-500">
            Create a transfer to move inventory between warehouses
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const config = statusConfig[t.status];
            const fromWh = (t as any).from_warehouse;
            const toWh = (t as any).to_warehouse;

            return (
              <Link
                key={t.id}
                href={`/transfers/${t.id}`}
                className="card p-4 flex items-center gap-4 hover:bg-slate-800/50 transition group"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <ArrowRightLeft className="w-5 h-5 text-slate-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("pill text-xs border", config.bg, config.color)}>
                      {config.label}
                    </span>
                    <span className="text-xs text-slate-500 capitalize">
                      {t.transfer_reason.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-sm">
                    <span className="text-slate-300">{fromWh?.name ?? "—"}</span>
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                    <span className="text-slate-300">{toWh?.name ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(t.initiated_date).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="w-3 h-3" />
                      {t.total_items} items
                    </span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-sm text-slate-300">
                    <span className="font-medium text-white">{t.shipped_items}</span>
                    <span className="text-slate-500">/{t.total_items}</span>
                    <span className="text-xs text-slate-500 ml-1">shipped</span>
                  </div>
                  {t.variance_count > 0 && (
                    <div className="text-xs text-amber-400 mt-0.5">
                      {t.variance_count} variance{t.variance_count !== 1 ? "s" : ""}
                    </div>
                  )}
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
