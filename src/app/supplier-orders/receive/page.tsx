"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package, Check, AlertTriangle } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { SupplierOrder } from "@/lib/types";

export default function ReceiveOrderPage() {
  const router = useRouter();
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<SupplierOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    actual_delivery: new Date().toISOString().split("T")[0],
    received_qty: 0,
    quality_issues: false,
  });

  const searchOrder = async () => {
    if (!orderId.trim()) return;
    setLoading(true);
    setError("");
    setOrder(null);

    const r = await fetch(`/api/supplier-orders/${orderId}`);
    if (r.ok) {
      const data = await r.json();
      if (data.status === "received") {
        setError("This order has already been received");
      } else {
        setOrder(data);
        setForm({
          ...form,
          received_qty: data.ordered_qty,
        });
      }
    } else {
      setError("Order not found");
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setLoading(true);
    setError("");

    const orderDate = new Date(order.order_date);
    const actualDate = new Date(form.actual_delivery);
    if (actualDate < orderDate) {
      setError("Actual delivery cannot be before order date");
      setLoading(false);
      return;
    }

    const maxOverage = order.ordered_qty * 1.05;
    if (form.received_qty > maxOverage) {
      setError(`Received quantity cannot exceed ordered quantity + 5% (max: ${maxOverage.toFixed(2)})`);
      setLoading(false);
      return;
    }

    const r = await fetch(`/api/supplier-orders/${order.id}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (r.ok) {
      router.push("/supplier-orders");
    } else {
      const data = await r.json();
      setError(data.error || "Failed to receive order");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Link href="/supplier-orders" className="p-2 hover:bg-slate-800 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Receive Order</h1>
          <p className="text-sm text-slate-500 mt-1">Log receipt of a supplier order</p>
        </div>
      </div>

      <div className="card p-6 max-w-2xl">
        <div className="mb-5">
          <label className="block text-sm text-slate-400 mb-1">Search Order by ID</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter order ID…"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
            <button
              onClick={searchOrder}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium text-sm rounded-lg transition"
            >
              Search
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/15 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {order && (
          <>
            <div className="mb-5 p-4 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-slate-400" />
                <span className="font-medium text-white">{(order as any).suppliers?.name || "Supplier"}</span>
              </div>
              <div className="text-sm text-slate-400">
                Product: {(order as any).products?.name || "Unknown"}
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                <div>
                  <span className="text-slate-500">Order Date:</span>
                  <span className="ml-2 text-slate-200">{formatDate(order.order_date)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Expected:</span>
                  <span className="ml-2 text-slate-200">{formatDate(order.expected_delivery)}</span>
                </div>
                <div>
                  <span className="text-slate-500">Ordered Qty:</span>
                  <span className="ml-2 text-slate-200">{order.ordered_qty}</span>
                </div>
                <div>
                  <span className="text-slate-500">Unit Cost:</span>
                  <span className="ml-2 text-slate-200">${order.unit_cost.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Actual Delivery Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={form.actual_delivery}
                  onChange={(e) => setForm({ ...form, actual_delivery: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">
                  Received Quantity <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  max={order.ordered_qty * 1.05}
                  value={form.received_qty}
                  onChange={(e) => setForm({ ...form, received_qty: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Ordered: {order.ordered_qty} | Max (5% overage): {(order.ordered_qty * 1.05).toFixed(2)}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="quality_issues"
                  checked={form.quality_issues}
                  onChange={(e) => setForm({ ...form, quality_issues: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-red-500 focus:ring-red-500/50"
                />
                <label htmlFor="quality_issues" className="text-sm text-slate-300">
                  Quality issues detected
                </label>
              </div>

              {form.received_qty > 0 && (
                <div className="p-3 bg-slate-800/50 rounded-lg">
                  <div className="text-sm text-slate-400">Final Cost</div>
                  <div className="text-lg font-bold text-white">
                    ${(form.received_qty * order.unit_cost).toFixed(2)}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Link
                  href="/supplier-orders"
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-400 text-black font-medium text-sm rounded-lg transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {loading ? "Processing…" : "Receive Order"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
