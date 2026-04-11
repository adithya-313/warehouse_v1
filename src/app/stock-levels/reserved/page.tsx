"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Package, Lock, Search, Warehouse, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StockLevelReserved, Warehouse as WarehouseType } from "@/lib/types";

export default function ReservedStockPage() {
  const [stockLevels, setStockLevels] = useState<StockLevelReserved[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/stock-levels/reserved").then((r) => r.json()),
      fetch("/api/warehouses").then((r) => r.json()),
    ]).then(([stock, wh]) => {
      setStockLevels(Array.isArray(stock) ? stock : []);
      setWarehouses(Array.isArray(wh) ? wh : []);
    }).finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const filtered = warehouseFilter === "all" ? stockLevels : stockLevels.filter((s) => s.warehouse_id === warehouseFilter);
    return {
      totalProducts: filtered.length,
      totalQty: filtered.reduce((s, i) => s + i.current_qty, 0),
      totalReserved: filtered.reduce((s, i) => s + i.reserved_qty, 0),
      totalAvailable: filtered.reduce((s, i) => s + i.available_qty, 0),
      reservedItems: filtered.filter((i) => i.reserved_qty > 0).length,
    };
  }, [stockLevels, warehouseFilter]);

  const filtered = useMemo(() => {
    return stockLevels.filter((s) => {
      if (warehouseFilter !== "all" && s.warehouse_id !== warehouseFilter) return false;
      if (search && !s.product_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [stockLevels, warehouseFilter, search]);

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
        <Link href="/transfers" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Transfers
        </Link>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Lock className="w-5 h-5 text-amber-400" />
          Reserved Stock
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Inventory locked in-transit between warehouses
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card p-4">
          <div className="text-2xl font-bold text-white">{stats.totalProducts}</div>
          <div className="text-sm text-slate-400">Products</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-white">{stats.totalQty.toLocaleString()}</div>
          <div className="text-sm text-slate-400">Total Qty</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-amber-400">{stats.totalReserved.toLocaleString()}</div>
          <div className="text-sm text-slate-400">Reserved</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-green-400">{stats.totalAvailable.toLocaleString()}</div>
          <div className="text-sm text-slate-400">Available</div>
        </div>
        <div className="card p-4 flex items-center justify-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <div>
            <div className="text-lg font-bold text-amber-400">{stats.reservedItems}</div>
            <div className="text-xs text-slate-400">Items Locked</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <select
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
        >
          <option value="all">All Warehouses</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <Package className="w-10 h-10 text-slate-600" />
          <div className="text-white font-medium">No stock levels found</div>
          <div className="text-sm text-slate-500">
            Stock levels will appear here when inventory is synced
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
                  <th className="text-left px-4 py-3 font-medium">Product</th>
                  <th className="text-left px-4 py-3 font-medium">Warehouse</th>
                  <th className="text-right px-4 py-3 font-medium">Current</th>
                  <th className="text-right px-4 py-3 font-medium">Reserved</th>
                  <th className="text-right px-4 py-3 font-medium">Available</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const isLowStock = item.available_qty < item.reserved_qty;
                  const warehouse = warehouses.find((w) => w.id === item.warehouse_id);
                  return (
                    <tr key={`${item.product_id}-${item.warehouse_id}`} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <div className="text-slate-200 font-medium">{item.product_name}</div>
                        <div className="text-xs text-slate-500">{item.category ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-slate-400">
                          <Warehouse className="w-3 h-3" />
                          {warehouse?.name ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-200 tabular-nums">
                        {item.current_qty.toLocaleString()}
                        <span className="text-xs text-slate-500 ml-1">{item.unit}</span>
                      </td>
                      <td className={cn(
                        "px-4 py-3 text-right tabular-nums",
                        item.reserved_qty > 0 ? "text-amber-400" : "text-slate-500"
                      )}>
                        {item.reserved_qty > 0 && <Lock className="w-3 h-3 inline mr-1" />}
                        {item.reserved_qty.toLocaleString()}
                      </td>
                      <td className={cn(
                        "px-4 py-3 text-right tabular-nums",
                        isLowStock ? "text-red-400" : "text-green-400"
                      )}>
                        {item.available_qty.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.reserved_qty > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <Lock className="w-3 h-3" />
                            In Transit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/15 text-green-400 border border-green-500/30">
                            Available
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-slate-800 text-xs text-slate-600">
            Showing {filtered.length} products
          </div>
        </div>
      )}

      <div className="card p-4">
        <h3 className="text-sm font-medium text-white mb-2">Understanding Reserved Stock</h3>
        <div className="text-sm text-slate-400 space-y-2">
          <p><span className="text-amber-400">Reserved</span>: Quantity locked due to approved transfers. This stock is set aside and cannot be used for other transfers until the transfer is cancelled or completed.</p>
          <p><span className="text-green-400">Available</span>: Current quantity minus reserved quantity. This is what you can safely allocate to new transfers.</p>
          <p>If available quantity is less than reserved, there may be an issue with the transfer workflow.</p>
        </div>
      </div>
    </div>
  );
}
