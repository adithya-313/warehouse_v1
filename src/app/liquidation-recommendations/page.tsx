"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Truck, RotateCcw, Gift, Clock } from "lucide-react";
import { cn, formatNumber, formatDate } from "@/lib/utils";
import type { LiquidationRecommendation, LiquidationAction, UrgencyLevel, Warehouse } from "@/lib/types";

const actionIcon: Record<LiquidationAction, React.ElementType> = {
  liquidate_discount: AlertTriangle,
  transfer_to_hub: Truck,
  return_to_supplier: RotateCcw,
  bundle_promotion: Gift,
};

const actionLabel: Record<LiquidationAction, string> = {
  liquidate_discount: "Liquidate at Discount",
  transfer_to_hub: "Transfer to Hub",
  return_to_supplier: "Return to Supplier",
  bundle_promotion: "Bundle Promotion",
};

const urgencyColor: Record<UrgencyLevel, { badge: string; border: string }> = {
  high: { badge: "bg-red-500/15 text-red-400", border: "border-red-500/30" },
  medium: { badge: "bg-yellow-500/15 text-yellow-400", border: "border-yellow-500/30" },
  low: { badge: "bg-blue-500/15 text-blue-400", border: "border-blue-500/30" },
};

export default function LiquidationPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("");
  const [items, setItems] = useState<LiquidationRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<UrgencyLevel | "all">("all");
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/warehouses")
      .then((r) => r.json())
      .then((data) => {
        setWarehouses(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) {
          setSelectedWarehouse(data[0].id);
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedWarehouse) return;
    setLoading(true);
    const url = `/api/liquidation-recommendations?warehouse_id=${selectedWarehouse}${filter !== "all" ? `&urgency=${filter}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
      })
      .finally(() => setLoading(false));
  }, [selectedWarehouse, filter]);

  const acknowledge = async (id: string, action: LiquidationAction) => {
    setAcknowledging(id);
    try {
      await fetch(`/api/liquidation-recommendations/${id}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manager_id: "system", action_taken: action }),
      });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } finally {
      setAcknowledging(null);
    }
  };

  const grouped = {
    high: items.filter((i) => i.urgency_level === "high"),
    medium: items.filter((i) => i.urgency_level === "medium"),
    low: items.filter((i) => i.urgency_level === "low"),
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Liquidation Recommendations</h1>
          <p className="text-sm text-slate-500 mt-1">Overstock alerts with suggested actions</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as UrgencyLevel | "all")}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
          >
            <option value="all">All Urgency</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <Check className="w-10 h-10 text-green-400" />
          <div className="text-white font-medium">All clear!</div>
          <div className="text-sm text-slate-500">No liquidation recommendations at this time</div>
        </div>
      ) : (
        <div className="space-y-6">
          {(["high", "medium", "low"] as UrgencyLevel[]).map((level) => {
            const group = grouped[level];
            if (group.length === 0) return null;
            const { badge, border } = urgencyColor[level];

            return (
              <div key={level}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn("pill text-xs", badge)}>
                    {level.toUpperCase()}
                  </span>
                  <span className="text-sm text-slate-400">{group.length} items</span>
                </div>
                <div className="space-y-3">
                  {group.map((item) => {
                    const product = (item as any).products;
                    const ActionIcon = actionIcon[item.recommended_action];
                    return (
                      <div
                        key={item.id}
                        className={cn("card p-4 flex gap-4 items-start border-2", border)}
                      >
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", badge)}>
                          <ActionIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-white">{product?.name || "Unknown"}</span>
                            <span className="text-sm text-slate-500">{product?.category}</span>
                            {item.days_to_expiry !== null && (
                              <span className="flex items-center gap-1 text-xs text-amber-400">
                                <Clock className="w-3 h-3" />
                                Expires in {item.days_to_expiry}d
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                            <span>Qty: <strong className="text-slate-200">{formatNumber(item.current_qty)}</strong></span>
                            <span>Discount: <strong className="text-amber-400">{item.discount_pct}%</strong></span>
                            <span>Est. Loss: <strong className="text-red-400">${formatNumber(item.estimated_revenue_loss)}</strong></span>
                          </div>
                          <div className="mt-2 text-xs text-slate-500">
                            {actionLabel[item.recommended_action]}
                          </div>
                        </div>
                        <button
                          onClick={() => acknowledge(item.id, item.recommended_action)}
                          disabled={acknowledging === item.id}
                          className="flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25 transition disabled:opacity-50"
                        >
                          {acknowledging === item.id ? "…" : "Approve"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
