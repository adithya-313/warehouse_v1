"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, CheckCircle, XCircle, Clock } from "lucide-react";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import type { SupplierOrder } from "@/lib/types";

export default function SupplierOrdersPage() {
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "received">("all");

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    const r = await fetch("/api/supplier-orders?days=90");
    if (r.ok) {
      const data = await r.json();
      setOrders(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  const filtered = orders.filter((o) => {
    const supplierName = (o as any).suppliers?.name?.toLowerCase() || "";
    const productName = (o as any).products?.name?.toLowerCase() || "";
    const matchSearch = !search || supplierName.includes(search.toLowerCase()) || productName.includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Supplier Orders</h1>
          <p className="text-sm text-slate-500 mt-1">Track and manage supplier orders</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/supplier-orders/receive"
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-400 text-black font-medium text-sm rounded-lg transition"
          >
            <CheckCircle className="w-4 h-4" />
            Receive Order
          </Link>
          <Link
            href="/supplier-orders/new"
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium text-sm rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            New Order
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by supplier or product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "pending" | "received")}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="received">Received</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <Clock className="w-10 h-10 text-slate-500" />
          <div className="text-white font-medium">No orders found</div>
          <div className="text-sm text-slate-500">Create a new order to get started</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
                  <th className="text-left px-4 py-3 font-medium">Supplier</th>
                  <th className="text-left px-4 py-3 font-medium">Product</th>
                  <th className="text-left px-4 py-3 font-medium">Order Date</th>
                  <th className="text-left px-4 py-3 font-medium">Expected</th>
                  <th className="text-left px-4 py-3 font-medium">Received</th>
                  <th className="text-right px-4 py-3 font-medium">Qty</th>
                  <th className="text-right px-4 py-3 font-medium">Cost</th>
                  <th className="text-center px-4 py-3 font-medium">On Time</th>
                  <th className="text-center px-4 py-3 font-medium">Quality</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id} className="trow">
                    <td className="px-4 py-3 font-medium text-slate-100">
                      {(order as any).suppliers?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {(order as any).products?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-200">{formatDate(order.order_date)}</td>
                    <td className="px-4 py-3 text-slate-200">{formatDate(order.expected_delivery)}</td>
                    <td className="px-4 py-3 text-slate-200">
                      {order.actual_delivery ? formatDate(order.actual_delivery) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                      {formatNumber(order.ordered_qty)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                      ${formatNumber(order.total_cost || order.ordered_qty * order.unit_cost)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {order.on_time !== null ? (
                        order.on_time ? (
                          <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                        )
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {order.quality_issues ? (
                        <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                      ) : order.status === "received" ? (
                        <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "pill text-xs",
                        order.status === "received" ? "bg-green-500/15 text-green-400" :
                        order.status === "pending" ? "bg-yellow-500/15 text-yellow-400" :
                        "bg-slate-500/15 text-slate-400"
                      )}>
                        {order.status}
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
