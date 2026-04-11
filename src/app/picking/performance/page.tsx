"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, Clock, Target, Award, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PickBatchRow } from "@/lib/types";

export default function PickingPerformancePage() {
  const [batches, setBatches] = useState<PickBatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pick-batches")
      .then((r) => r.json())
      .then((data) => setBatches(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const completed = batches.filter((b) => b.status === "completed");
    const inProgress = batches.filter((b) => b.status === "in-progress" || b.status === "assigned");

    const efficiencyScores = completed
      .map((b) => b.efficiency_score)
      .filter((s) => s !== null && s !== undefined) as number[];

    const avgEfficiency = efficiencyScores.length > 0
      ? efficiencyScores.reduce((a, b) => a + b, 0) / efficiencyScores.length
      : 0;

    const totalPicks = completed.reduce((sum, b) => sum + b.total_picks_completed, 0);
    const totalItems = completed.reduce((sum, b) => sum + b.total_items, 0);

    const recentBatches = completed.slice(0, 10);
    const trendData = recentBatches.reverse().map((b, i) => ({
      date: new Date(b.completed_date || b.created_date).toLocaleDateString(),
      efficiency: b.efficiency_score || 0,
      items: b.total_items,
    }));

    return {
      totalBatches: completed.length,
      activeBatches: inProgress.length,
      avgEfficiency: Math.round(avgEfficiency * 100) / 100,
      bestEfficiency: efficiencyScores.length > 0 ? Math.max(...efficiencyScores) : 0,
      totalPicks,
      totalItems,
      trendData,
      completedBatches: completed,
    };
  }, [batches]);

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
        <Link href="/picking" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Picking
        </Link>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-cyan-400" />
          Picking Performance
        </h1>
        <p className="text-sm text-slate-500 mt-1">Picker efficiency and batch analytics</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalBatches}</div>
          <div className="text-sm text-slate-400">Completed Batches</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-yellow-500" />
          </div>
          <div className="text-2xl font-bold text-cyan-400">{stats.avgEfficiency}</div>
          <div className="text-sm text-slate-400">Avg Picks/Min</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-400">{stats.bestEfficiency.toFixed(1)}</div>
          <div className="text-sm text-slate-400">Best Picks/Min</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.activeBatches}</div>
          <div className="text-sm text-slate-400">Active Batches</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.totalPicks}</div>
          <div className="text-sm text-slate-400">Total Picks</div>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="text-sm font-medium text-white mb-4">Efficiency Trend (Last 10 Batches)</h2>
        {stats.trendData.length > 0 ? (
          <div className="flex items-end gap-2 h-32">
            {stats.trendData.map((d, i) => {
              const maxEff = Math.max(...stats.trendData.map((t) => t.efficiency), 1);
              const height = (d.efficiency / maxEff) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center">
                    <span className="text-xs text-cyan-400 mb-1">{d.efficiency.toFixed(1)}</span>
                    <div
                      className="w-full bg-gradient-to-t from-cyan-500/20 to-cyan-500 rounded-t transition-all hover:from-cyan-500/30 hover:to-cyan-500"
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-600">{d.date.slice(0, 5)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">No completed batches yet</div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <h2 className="text-sm font-medium text-white">Completed Batches</h2>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50 sticky top-0">
              <tr className="text-xs uppercase text-slate-500">
                <th className="text-left px-4 py-2 font-medium">Date</th>
                <th className="text-left px-4 py-2 font-medium">Warehouse</th>
                <th className="text-right px-4 py-2 font-medium">Items</th>
                <th className="text-right px-4 py-2 font-medium">Picks</th>
                <th className="text-right px-4 py-2 font-medium">Efficiency</th>
                <th className="text-center px-4 py-2 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody>
              {stats.completedBatches.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-600">No completed batches yet</td>
                </tr>
              )}
              {stats.completedBatches.map((batch) => {
                const warehouse = (batch as any).warehouses;
                const progress = batch.total_items > 0 ? Math.round((batch.total_picks_completed / batch.total_items) * 100) : 0;
                return (
                  <tr key={batch.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-2 text-slate-400">
                      {new Date(batch.completed_date || batch.created_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 text-slate-200">{warehouse?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-right text-slate-400 tabular-nums">{batch.total_items}</td>
                    <td className="px-4 py-2 text-right text-slate-400 tabular-nums">{batch.total_picks_completed}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={cn(
                        "tabular-nums font-medium",
                        (batch.efficiency_score || 0) >= stats.avgEfficiency ? "text-green-400" : "text-yellow-400"
                      )}>
                        {batch.efficiency_score?.toFixed(1) ?? "—"} picks/min
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{progress}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-medium text-white mb-2">Performance Insights</h3>
        <div className="text-sm text-slate-400 space-y-2">
          <p>
            <span className="text-cyan-400">Efficiency Score</span> is calculated as items picked per minute of picking time.
            Higher scores indicate faster, more efficient picking.
          </p>
          <p>
            <span className="text-green-400">Target: 10+ picks/min</span> is considered good for most warehouse operations.
            Top performers achieve 15+ picks/min consistently.
          </p>
        </div>
      </div>
    </div>
  );
}
