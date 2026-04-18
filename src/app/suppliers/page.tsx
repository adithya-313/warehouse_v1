"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Star, TrendingUp, CheckCircle, AlertTriangle, Package } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import type { SupplierWithPerformance, SupplierCategory, SupplierStatus } from "@/lib/types";

const categoryColors: Record<SupplierCategory, string> = {
  primary: "bg-purple-500/15 text-purple-400",
  secondary: "bg-slate-500/15 text-slate-400",
  emergency: "bg-red-500/15 text-red-400",
};

function reliabilityColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

function reliabilityBg(score: number): string {
  if (score >= 80) return "bg-green-500/15";
  if (score >= 60) return "bg-yellow-500/15";
  return "bg-red-500/15";
}

function RatingStars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-slate-600 text-xs">No rating</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn("w-3 h-3", i <= rating ? "text-amber-400 fill-amber-400" : "text-slate-600")}
        />
      ))}
    </div>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierWithPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<SupplierStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<SupplierCategory | "all">("all");
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, [statusFilter, categoryFilter]);

  const fetchSuppliers = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);

    const r = await fetch(`/api/suppliers?${params}`);
    if (r.ok) {
      const data = await r.json();
      console.log("RAW_SUPPLIER_DATA:", data[0]);
      setSuppliers(data);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Suppliers</h1>
          <p className="text-sm text-slate-500 mt-1">Manage suppliers and track performance</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium text-sm rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            New Supplier
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SupplierStatus | "all")}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as SupplierCategory | "all")}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
        >
          <option value="all">All Categories</option>
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="emergency">Emergency</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <Package className="w-10 h-10 text-slate-500" />
          <div className="text-white font-medium">No suppliers found</div>
          <div className="text-sm text-slate-500">Add your first supplier to get started</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
                  <th className="text-left px-4 py-3 font-medium min-w-[180px]">Supplier</th>
                  <th className="text-center px-4 py-3 font-medium w-28">Category</th>
                  <th className="text-center px-4 py-3 font-medium w-24">Status</th>
                  <th className="text-center px-4 py-3 font-medium w-24">Rating</th>
                  <th className="text-right px-4 py-3 font-medium w-20">On-Time %</th>
                  <th className="text-right px-4 py-3 font-medium w-20">Quality</th>
                  <th className="text-center px-4 py-3 font-medium w-28">Reliability</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => {
                  const perf = supplier.supplier_performance || {};
                  const onTime = perf.on_time_delivery_pct != null ? `${perf.on_time_delivery_pct.toFixed(0)}%` : "—";
                  const quality = perf.quality_score != null ? perf.quality_score.toFixed(0) : "—";
                  const reliability = perf.reliability_score != null ? perf.reliability_score.toFixed(0) : "—";
                  const isLowPerformer = perf && perf.reliability_score < 60;
                  return (
                    <tr key={supplier.id} className={cn("trow", isLowPerformer && "border-l-2 border-l-red-500")}>
                      <td className="px-4 py-3 min-w-[180px]">
                        <div className="font-medium text-slate-100">{supplier.name}</div>
                        <div className="text-xs text-slate-500">{supplier.email || "No email"}</div>
                      </td>
                      <td className="px-4 py-3 text-center w-28">
                        <span className={cn("pill text-xs", categoryColors[supplier.category])}>
                          {supplier.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center w-24">
                        <span className={cn("pill text-xs", supplier.status === "active" ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-slate-500/15 text-slate-400 border-slate-500/30")}>
                          {supplier.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center w-24">
                        <RatingStars rating={supplier.rating} />
                      </td>
                      <td className="px-4 py-3 text-right w-20 tabular-nums">
                        <span className={perf.on_time_delivery_pct != null ? cn(reliabilityColor(perf.on_time_delivery_pct)) : "text-slate-600"}>
                          {onTime}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right w-20 tabular-nums">
                        <span className={perf.quality_score != null ? cn(reliabilityColor(perf.quality_score)) : "text-slate-600"}>
                          {quality}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center w-28">
                        {perf.reliability_score != null ? (
                          <div className="flex items-center justify-center gap-2">
                            {perf.reliability_score < 60 && (
                              <AlertTriangle className="w-4 h-4 text-red-400" />
                            )}
                            <span className={cn("pill text-xs", reliabilityBg(perf.reliability_score), reliabilityColor(perf.reliability_score))}>
                              {perf.reliability_score.toFixed(0)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right w-20">
                        <Link
                          href={`/suppliers/${supplier.id}`}
                          className="text-xs text-cyan-400 hover:text-cyan-300 transition"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNewModal && (
        <NewSupplierModal onClose={() => setShowNewModal(false)} onSuccess={() => { setShowNewModal(false); fetchSuppliers(); }} />
      )}
    </div>
  );
}

function NewSupplierModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    payment_terms: 30,
    avg_lead_time_days: 7,
    category: "secondary" as SupplierCategory,
    rating: 3,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const r = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (r.ok) {
      onSuccess();
    } else {
      const data = await r.json();
      setError(data.error || "Failed to create supplier");
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="card p-6 w-full max-w-md">
        <h2 className="text-lg font-bold text-white mb-4">New Supplier</h2>
        {error && <div className="mb-4 p-3 bg-red-500/15 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Contact Person</label>
              <input
                type="text"
                value={form.contact_person}
                onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Payment Terms (days)</label>
              <input
                type="number"
                min={1}
                value={form.payment_terms}
                onChange={(e) => setForm({ ...form, payment_terms: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Lead Time (days)</label>
              <input
                type="number"
                min={1}
                value={form.avg_lead_time_days}
                onChange={(e) => setForm({ ...form, avg_lead_time_days: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Rating (1-5)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as SupplierCategory })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium text-sm rounded-lg transition disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
