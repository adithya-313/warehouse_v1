"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRightLeft, Plus, Trash2, Search, MapPin, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Warehouse, Product, TransferReason } from "@/lib/types";

interface TransferItem {
  id: string;
  product_id: string;
  product_name: string;
  category: string;
  unit: string;
  requested_qty: number;
  available_qty: number;
}

const transferReasons: { value: TransferReason; label: string; desc: string }[] = [
  { value: "rebalance", label: "Rebalance", desc: "Balance stock levels across locations" },
  { value: "dead_stock_redistribution", label: "Dead Stock", desc: "Move slow-moving inventory" },
  { value: "demand_shift", label: "Demand Shift", desc: "Redirect to higher-demand location" },
  { value: "supplier_consolidation", label: "Consolidation", desc: "Consolidate from multiple sources" },
  { value: "other", label: "Other", desc: "Other reason" },
];

export default function NewTransferPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);

  const [from_warehouse_id, setFromWarehouseId] = useState("");
  const [to_warehouse_id, setToWarehouseId] = useState("");
  const [transfer_reason, setTransferReason] = useState<TransferReason>("rebalance");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransferItem[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/warehouses").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ]).then(([wh, prod]) => {
      setWarehouses(Array.isArray(wh) ? wh : []);
      setProducts(Array.isArray(prod) ? prod : []);
      if (wh.length > 0) setFromWarehouseId(wh[0].id);
      if (wh.length > 1) setToWarehouseId(wh[1].id);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!productSearch.trim()) {
      setSearchResults([]);
      return;
    }
    const results = products.filter(
      (p) =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.category?.toLowerCase().includes(productSearch.toLowerCase())
    );
    setSearchResults(results.slice(0, 10));
  }, [productSearch, products]);

  const addItem = (product: Product) => {
    if (items.find((i) => i.product_id === product.id)) return;
    setItems([
      ...items,
      {
        id: crypto.randomUUID(),
        product_id: product.id,
        product_name: product.name,
        category: product.category ?? "—",
        unit: product.unit,
        requested_qty: 1,
        available_qty: 0,
      },
    ]);
    setProductSearch("");
    setSearchResults([]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const updateQty = (id: string, qty: number) => {
    setItems(items.map((i) => (i.id === id ? { ...i, requested_qty: Math.max(0, qty) } : i)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (from_warehouse_id === to_warehouse_id) {
      setError("Cannot transfer to the same warehouse");
      return;
    }

    if (items.length === 0) {
      setError("At least one item is required");
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_warehouse_id,
          to_warehouse_id,
          transfer_reason,
          notes,
          items: items.map((i) => ({ product_id: i.product_id, requested_qty: i.requested_qty })),
        }),
      });

      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error || "Failed to create transfer");
      }

      const data = await r.json();
      router.push(`/transfers/${data.id}`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/transfers" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Transfers
        </Link>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
          New Transfer
        </h1>
        <p className="text-sm text-slate-500 mt-1">Create a draft transfer to move inventory between warehouses</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm">{error}</div>
        )}

        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-medium text-white">Warehouse Selection</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                <MapPin className="w-3 h-3 inline mr-1" />
                From Warehouse
              </label>
              <select
                value={from_warehouse_id}
                onChange={(e) => setFromWarehouseId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
                required
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id} disabled={w.id === to_warehouse_id}>
                    {w.name} {w.location ? `(${w.location})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                <MapPin className="w-3 h-3 inline mr-1" />
                To Warehouse
              </label>
              <select
                value={to_warehouse_id}
                onChange={(e) => setToWarehouseId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
                required
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id} disabled={w.id === from_warehouse_id}>
                    {w.name} {w.location ? `(${w.location})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-medium text-white">Transfer Reason</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {transferReasons.map((r) => (
              <label
                key={r.value}
                className={cn(
                  "p-3 rounded-lg border cursor-pointer transition text-sm",
                  transfer_reason === r.value
                    ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                    : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
                )}
              >
                <input
                  type="radio"
                  name="transfer_reason"
                  value={r.value}
                  checked={transfer_reason === r.value}
                  onChange={() => setTransferReason(r.value)}
                  className="sr-only"
                />
                <div className="font-medium">{r.label}</div>
                <div className="text-xs mt-0.5 opacity-70">{r.desc}</div>
              </label>
            ))}
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-medium text-white">Items</h2>
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products to add..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addItem(p)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-700 transition border-b border-slate-700/50 last:border-0"
                  >
                    <div className="text-slate-200">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.category ?? "—"} • {p.unit}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 ? (
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/50">
                  <tr className="text-xs uppercase text-slate-500">
                    <th className="text-left px-3 py-2 font-medium">Product</th>
                    <th className="text-left px-3 py-2 font-medium">Category</th>
                    <th className="text-right px-3 py-2 font-medium w-32">Qty</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-slate-800">
                      <td className="px-3 py-2 text-slate-200">{item.product_name}</td>
                      <td className="px-3 py-2 text-slate-500 text-xs">{item.category}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={item.requested_qty}
                            onChange={(e) => updateQty(item.id, parseFloat(e.target.value) || 0)}
                            min="0"
                            className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 text-right focus:outline-none focus:border-cyan-500/50"
                          />
                          <span className="text-xs text-slate-500">{item.unit}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="p-1 text-slate-500 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-sm">
              <Package className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              No items added yet. Search for products above.
            </div>
          )}
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-medium text-white">Notes (optional)</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this transfer..."
            rows={3}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <Link
            href="/transfers"
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-400 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 transition text-center"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || items.length === 0}
            className="flex-1 px-4 py-2 text-sm font-medium text-cyan-400 bg-cyan-500/15 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                Creating...
              </span>
            ) : (
              "Create Draft Transfer"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
