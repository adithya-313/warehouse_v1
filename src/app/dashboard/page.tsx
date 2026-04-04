"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Package, AlertTriangle, Warehouse, TrendingUp,
  Search, ChevronRight, ArrowUpDown
} from "lucide-react";
import { cn, healthColor, classificationColor, formatDays, formatNumber, formatDate } from "@/lib/utils";
import type { ProductRow, DashboardSummary, HealthLabel, Classification } from "@/lib/types";

// ─── Metric Card ─────────────────────────────────────────────
function MetricCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", accent)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-slate-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-slate-600 mt-1">{sub}</div>}
    </div>
  );
}

// ─── Health Pill ──────────────────────────────────────────────
function HealthPill({ label, score }: { label: HealthLabel; score: number }) {
  return (
    <span className={cn("pill", healthColor(label))}>
      <span className="font-bold">{Math.round(score)}</span>
      <span className="opacity-70">{label}</span>
    </span>
  );
}

// ─── Classification Badge ─────────────────────────────────────
function ClassBadge({ c }: { c: Classification }) {
  return <span className={cn("pill border-transparent", classificationColor(c))}>{c}</span>;
}

// ─── Dashboard Page ───────────────────────────────────────────
export default function DashboardPage() {
  const [summary,  setSummary]  = useState<DashboardSummary | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [catFilter,setCatFilter]= useState("all");
  const [clsFilter,setClsFilter]= useState("all");

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/summary").then((r) => r.json()),
      fetch("/api/products").then((r) => r.json()),
    ]).then(([sum, prods]) => {
      setSummary(sum);
      setProducts(Array.isArray(prods) ? prods : []);
    }).finally(() => setLoading(false));
  }, []);

  const categories    = useMemo(() => ["all", ...Array.from(new Set(products.map((p) => p.category ?? "—")))], [products]);
  const classifications = useMemo(() => ["all", "Fast Moving", "Slow Moving", "Dead Stock", "Seasonal", "Expiry Risk"], []);

  const filtered = useMemo(() =>
    products.filter((p) => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchCat    = catFilter === "all" || p.category === catFilter;
      const matchCls    = clsFilter === "all" || p.classification === clsFilter;
      return matchSearch && matchCat && matchCls;
    }),
    [products, search, catFilter, clsFilter]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          <span className="text-sm">Loading dashboard…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-white">Inventory Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Real-time warehouse health overview</p>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Products" value={summary?.total_products ?? 0}
          icon={Package} accent="bg-cyan-500/15 text-cyan-400"
        />
        <MetricCard
          label="Critical Alerts" value={summary?.critical_alerts ?? 0}
          sub={`${summary?.warning_alerts ?? 0} warnings`}
          icon={AlertTriangle} accent="bg-red-500/15 text-red-400"
        />
        <MetricCard
          label="Avg Health Score" value={`${summary?.avg_health_score?.toFixed(0) ?? 0}/100`}
          icon={TrendingUp} accent="bg-green-500/15 text-green-400"
        />
        <MetricCard
          label="Warehouses" value={summary?.warehouses_count ?? 0}
          icon={Warehouse} accent="bg-purple-500/15 text-purple-400"
        />
      </div>

      {/* Sub-metric row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Stockout Risk (<14d)", value: summary?.stockout_risk_count ?? 0, color: "text-yellow-400" },
          { label: "Expiry Risk (>70 score)", value: summary?.expiry_risk_count ?? 0, color: "text-orange-400" },
          { label: "Dead Stock Items",          value: summary?.dead_stock_count ?? 0, color: "text-slate-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 flex items-center justify-between">
            <span className="text-sm text-slate-400">{label}</span>
            <span className={cn("text-xl font-bold", color)}>{value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition"
          />
        </div>

        {/* Category */}
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
        >
          {categories.map((c) => <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>)}
        </select>

        {/* Classification */}
        <select
          value={clsFilter}
          onChange={(e) => setClsFilter(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
        >
          {classifications.map((c) => <option key={c} value={c}>{c === "all" ? "All Classifications" : c}</option>)}
        </select>
      </div>

      {/* Product Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
                <th className="text-left px-4 py-3 font-medium">Product</th>
                <th className="text-left px-4 py-3 font-medium">Category</th>
                <th className="text-right px-4 py-3 font-medium">Stock</th>
                <th className="text-center px-4 py-3 font-medium">Health</th>
                <th className="text-center px-4 py-3 font-medium">Classification</th>
                <th className="text-right px-4 py-3 font-medium">Days Left</th>
                <th className="text-right px-4 py-3 font-medium">Expiry Risk</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-600 text-sm">
                    No products match your filters.
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className={cn(
                    "trow",
                    p.health_label === "Critical" && "glow-critical"
                  )}
                >
                  <td className="px-4 py-3 font-medium text-slate-100">{p.name}</td>
                  <td className="px-4 py-3 text-slate-400">{p.category ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-200 tabular-nums">
                    {formatNumber(p.current_stock)}
                    {p.current_stock <= p.reorder_point && p.reorder_point > 0 && (
                      <span className="ml-1 text-red-400 text-xs">⬇ low</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <HealthPill label={p.health_label} score={p.health_score} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ClassBadge c={p.classification} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                    {formatDays(p.days_to_stockout)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={p.expiry_risk_score > 70 ? "text-red-400" : p.expiry_risk_score > 40 ? "text-yellow-400" : "text-slate-400"}>
                      {Math.round(p.expiry_risk_score)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/products/${p.id}`}
                      className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition"
                    >
                      View <ChevronRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-slate-800 text-xs text-slate-600">
          Showing {filtered.length} of {products.length} products
        </div>
      </div>
    </div>
  );
}
