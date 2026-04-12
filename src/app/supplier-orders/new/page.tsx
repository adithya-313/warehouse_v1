"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";
import type { Supplier, Product } from "@/lib/types";

export default function NewSupplierOrderPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    supplier_id: "",
    product_id: "",
    order_date: new Date().toISOString().split("T")[0],
    expected_delivery: "",
    ordered_qty: 1,
    unit_cost: 0,
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/suppliers?status=active").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ]).then(([sups, prods]) => {
      setSuppliers(Array.isArray(sups) ? sups : []);
      setProducts(Array.isArray(prods) ? prods : []);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!form.supplier_id || !form.product_id || !form.expected_delivery) {
      setError("Please fill in all required fields");
      setLoading(false);
      return;
    }

    const orderDate = new Date(form.order_date);
    const expectedDate = new Date(form.expected_delivery);
    if (expectedDate < orderDate) {
      setError("Expected delivery cannot be before order date");
      setLoading(false);
      return;
    }

    const r = await fetch("/api/supplier-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (r.ok) {
      router.push("/supplier-orders");
    } else {
      const data = await r.json();
      setError(data.error || "Failed to create order");
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
          <h1 className="text-xl font-bold text-white">New Supplier Order</h1>
          <p className="text-sm text-slate-500 mt-1">Create a new order with a supplier</p>
        </div>
      </div>

      <div className="card p-6 max-w-2xl">
        {error && (
          <div className="mb-4 p-3 bg-red-500/15 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Supplier <span className="text-red-400">*</span>
            </label>
            <select
              required
              value={form.supplier_id}
              onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">Select supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">
              Product <span className="text-red-400">*</span>
            </label>
            <select
              required
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="">Select product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.category || "uncategorized"})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Order Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                required
                value={form.order_date}
                onChange={(e) => setForm({ ...form, order_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Expected Delivery <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                required
                value={form.expected_delivery}
                onChange={(e) => setForm({ ...form, expected_delivery: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Ordered Quantity <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                value={form.ordered_qty}
                onChange={(e) => setForm({ ...form, ordered_qty: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Unit Cost ($) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                required
                min={0}
                step={0.01}
                value={form.unit_cost}
                onChange={(e) => setForm({ ...form, unit_cost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          {form.ordered_qty > 0 && form.unit_cost > 0 && (
            <div className="p-3 bg-slate-800/50 rounded-lg">
              <div className="text-sm text-slate-400">Total Cost</div>
              <div className="text-lg font-bold text-white">
                ${(form.ordered_qty * form.unit_cost).toFixed(2)}
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
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium text-sm rounded-lg transition disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
