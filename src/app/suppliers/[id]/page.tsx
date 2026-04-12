"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Star, Phone, Mail, Calendar, DollarSign, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import type { Supplier, SupplierPerformance, SupplierOrder } from "@/lib/types";

const categoryColors: Record<string, string> = {
  primary: "bg-purple-500/15 text-purple-400",
  secondary: "bg-slate-500/15 text-slate-400",
  emergency: "bg-red-500/15 text-red-400",
};

function reliabilityColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

export default function SupplierDetailPage() {
  const params = useParams();
  const supplierId = params.id as string;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [performance, setPerformance] = useState<SupplierPerformance | null>(null);
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "metrics" | "orders">("overview");

  useEffect(() => {
    if (!supplierId) return;
    setLoading(true);
    fetch(`/api/suppliers/${supplierId}`)
      .then((r) => r.json())
      .then((data) => setSupplier(data));

    fetch(`/api/suppliers/${supplierId}/performance?days=30`)
      .then((r) => r.json())
      .then((data) => {
        setPerformance(data.performance);
        setOrders(data.orders || []);
        setChartData(data.chart_data || []);
      })
      .finally(() => setLoading(false));
  }, [supplierId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="card p-12 flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="w-10 h-10 text-yellow-400" />
        <div className="text-white font-medium">Supplier not found</div>
      </div>
    );
  }

  const isLowPerformer = performance && performance.reliability_score < 60;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <Link href="/suppliers" className="p-2 hover:bg-slate-800 rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{supplier.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn("pill text-xs", categoryColors[supplier.category])}>{supplier.category}</span>
            <span className={cn("pill text-xs", supplier.status === "active" ? "bg-green-500/15 text-green-400" : "bg-slate-500/15 text-slate-400")}>
              {supplier.status}
            </span>
          </div>
        </div>
        <Link
          href="/supplier-orders/new"
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-medium text-sm rounded-lg transition"
        >
          New Order
        </Link>
      </div>

      {isLowPerformer && (
        <div className="card p-4 border-2 border-red-500/30 bg-red-500/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-red-400">Low Performance Alert</div>
              <div className="text-sm text-slate-300 mt-1">
                This supplier has a reliability score of {performance?.reliability_score.toFixed(0)}% (below 60%).
                Consider reducing orders or finding an alternative supplier.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-400">Rating</span>
          </div>
          <div className="text-xl font-bold text-white">{supplier.rating || "—"}/5</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-xs text-slate-400">On-Time</span>
          </div>
          <div className={cn("text-xl font-bold", reliabilityColor(performance?.on_time_delivery_pct || 0))}>
            {performance?.on_time_delivery_pct.toFixed(0) || 0}%
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-slate-400">Quality Score</span>
          </div>
          <div className={cn("text-xl font-bold", reliabilityColor(performance?.quality_score || 0))}>
            {performance?.quality_score.toFixed(0) || 100}
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-slate-400">Reliability</span>
          </div>
          <div className={cn("text-xl font-bold", reliabilityColor(performance?.reliability_score || 0))}>
            {performance?.reliability_score.toFixed(0) || 0}
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg w-fit">
        {(["overview", "metrics", "orders"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md transition",
              activeTab === tab ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
            )}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card p-5">
            <h3 className="text-sm font-medium text-slate-400 mb-4">Contact Information</h3>
            <div className="space-y-3">
              {supplier.contact_person && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-500 w-32">Contact</span>
                  <span className="text-sm text-slate-200">{supplier.contact_person}</span>
                </div>
              )}
              {supplier.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-200">{supplier.email}</span>
                </div>
              )}
              {supplier.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-200">{supplier.phone}</span>
                </div>
              )}
            </div>
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-medium text-slate-400 mb-4">Business Details</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-500 w-32">Lead Time</span>
                <span className="text-sm text-slate-200">{supplier.avg_lead_time_days} days</span>
              </div>
              <div className="flex items-center gap-3">
                <DollarSign className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-500 w-32">Payment Terms</span>
                <span className="text-sm text-slate-200">{supplier.payment_terms} days</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 w-32">30-Day Cost</span>
                <span className="text-sm text-slate-200">${formatNumber(performance?.total_cost_30_days || 0)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 w-32">Orders (30d)</span>
                <span className="text-sm text-slate-200">{performance?.last_30_days_orders || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "metrics" && (
        <div className="space-y-5">
          <div className="card p-4">
            <h3 className="text-sm font-medium text-slate-400 mb-4">On-Time Delivery Trend (30 Days)</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: number) => [`${value}%`, "On-Time %"]}
                  />
                  <Line type="monotone" dataKey="on_time_pct" stroke="#06b6d4" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-slate-500">No delivery data available</div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4">
              <div className="text-xs text-slate-500 mb-1">Avg Lead Time</div>
              <div className="text-lg font-bold text-white">{performance?.avg_lead_time_days.toFixed(1) || 0} days</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-slate-500 mb-1">Quality Issues</div>
              <div className="text-lg font-bold text-white">
                {orders.filter((o) => o.quality_issues).length}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-slate-500 mb-1">Total Orders (30d)</div>
              <div className="text-lg font-bold text-white">{performance?.last_30_days_orders || 0}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "orders" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase text-slate-500">
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
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-600 text-sm">
                      No orders found
                    </td>
                  </tr>
                )}
                {orders.map((order) => (
                  <tr key={order.id} className="trow">
                    <td className="px-4 py-3 text-slate-200">{formatDate(order.order_date)}</td>
                    <td className="px-4 py-3 text-slate-200">{formatDate(order.expected_delivery)}</td>
                    <td className="px-4 py-3 text-slate-200">
                      {order.actual_delivery ? formatDate(order.actual_delivery) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                      {formatNumber(order.ordered_qty)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-200">
                      ${formatNumber(order.total_cost || 0)}
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
                      <span className={cn("pill text-xs", order.status === "received" ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400")}>
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
