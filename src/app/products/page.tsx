"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, TrendingUp, TrendingDown, Minus, Search } from "lucide-react";
import { cn, healthColor, formatNumber } from "@/lib/utils";
import type { ProductRow, HealthLabel, DemandTrend, Classification } from "@/lib/types";

function TrendIcon({ trend }: { trend: DemandTrend }) {
  if (trend === "rising")  return <TrendingUp  className="w-3.5 h-3.5 text-green-400" />;
  if (trend === "falling") return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  return <Minus className="w-3.5 h-3.5 text-slate-400" />;
}

function ForecastBadge({ eligible }: { eligible: boolean }) {
  if (!eligible) return null;
  return (
    <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium rounded bg-cyan-500/20 text-cyan-400">
      ML
    </span>
  );
}

function classificationBadge(cls: Classification): string {
  switch (cls) {
    case "Fast Moving":   return "bg-green-500/15 text-green-400";
    case "Medium Moving": return "bg-yellow-500/15 text-yellow-400";
    case "Slow Moving":   return "bg-slate-500/15 text-slate-400";
    case "Dead Stock":    return "bg-red-500/15 text-red-400";
    default:              return "bg-slate-500/15 text-slate-400";
  }
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState<HealthLabel | "all">("all");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const r = await fetch("/api/products", { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      console.log("[DEBUG CLIENT] Received from API:", data[0]);
      console.log("[products] Fetched Products Count:", data.length);
      setProducts(data);
    }
    setLoading(false);
  };

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort();

  const filtered = products.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
    if (healthFilter !== "all" && p.health_label !== healthFilter) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Products</h1>
          <p className="text-sm text-slate-500 mt-1">View and manage inventory products</p>
        </div>
        <div className="text-sm text-slate-500">
          {filtered.length} of {products.length} products
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c ?? ""}>{c}</option>
          ))}
        </select>
        <select
          value={healthFilter}
          onChange={(e) => setHealthFilter(e.target.value as HealthLabel | "all")}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
        >
          <option value="all">All Health</option>
          <option value="Critical">Critical</option>
          <option value="Warning">Warning</option>
          <option value="Healthy">Healthy</option>
          <option value="Monitor">Monitor</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <Package className="w-10 h-10 text-slate-500" />
          <div className="text-white font-medium">No products found</div>
          <div className="text-sm text-slate-500">Try adjusting your search or filters</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
                  <th className="text-left px-4 py-3 font-medium">Product</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-right px-4 py-3 font-medium">Stock</th>
                  <th className="text-right px-4 py-3 font-medium">Reorder Pt</th>
                  <th className="text-center px-4 py-3 font-medium">Health</th>
                  <th className="text-center px-4 py-3 font-medium">Classification</th>
                  <th className="text-center px-4 py-3 font-medium">Trend</th>
                  <th className="text-right px-4 py-3 font-medium">Days to Stockout</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const isLow = product.health_label === "Critical";
                  return (
                    <tr key={product.id} className={cn("trow border-l-2", isLow ? "border-l-red-500" : "border-l-transparent")}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-100">{product.name}</span>
                          <ForecastBadge eligible={product.forecasting_eligible ?? false} />
                        </div>
                        {product.expiry_date && (
                          <div className="text-xs text-slate-500">Exp: {product.expiry_date}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {product.category || "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={cn(product.current_stock <= product.reorder_point ? "text-red-400" : "text-slate-200")}>
                          {formatNumber(product.current_stock)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                        {formatNumber(product.reorder_point)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("pill text-xs", healthColor(product.health_label))}>
                          {product.health_score > 0 ? Math.round(product.health_score) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("pill text-xs", classificationBadge(product.classification))}>
                          {product.classification}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <TrendIcon trend={product.demand_trend} />
                          <span className="text-xs text-slate-500 capitalize">{product.demand_trend}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                        {product.days_to_stockout != null ? product.days_to_stockout : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/products/${product.id}`}
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
    </div>
  );
}
