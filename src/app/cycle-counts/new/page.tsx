"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ClipboardList, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Warehouse, CycleCountType } from "@/lib/types";

export default function NewCycleCountPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [warehouse_id, setWarehouseId] = useState("");
  const [count_type, setCountType] = useState<CycleCountType>("full");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch("/api/warehouses")
      .then((r) => r.json())
      .then((data) => {
        setWarehouses(Array.isArray(data) ? data : []);
        if (data.length > 0) {
          setWarehouseId(data[0].id);
        }
      })
      .catch(() => setError("Failed to load warehouses"))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouse_id) {
      setError("Please select a warehouse");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const r = await fetch("/api/cycle-counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouse_id, count_type, notes }),
      });

      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error || "Failed to create cycle count");
      }

      const data = await r.json();
      router.push(`/cycle-counts/${data.id}`);
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
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/cycle-counts"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Cycle Counts
        </Link>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-cyan-400" />
          New Cycle Count
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Schedule a new inventory count for reconciliation
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            <MapPin className="w-4 h-4 inline mr-1" />
            Warehouse
          </label>
          <select
            value={warehouse_id}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50 transition"
            required
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} {w.location ? `(${w.location})` : ""}
              </option>
            ))}
          </select>
          {warehouses.length === 0 && (
            <p className="text-xs text-slate-500 mt-1">No warehouses available</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Count Type
          </label>
          <div className="flex gap-3">
            <label
              className={cn(
                "flex-1 p-3 rounded-lg border cursor-pointer transition text-sm",
                count_type === "full"
                  ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                  : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
              )}
            >
              <input
                type="radio"
                name="count_type"
                value="full"
                checked={count_type === "full"}
                onChange={() => setCountType("full")}
                className="sr-only"
              />
              <div className="font-medium">Full Count</div>
              <div className="text-xs mt-0.5 opacity-70">
                Count all products in the warehouse
              </div>
            </label>
            <label
              className={cn(
                "flex-1 p-3 rounded-lg border cursor-pointer transition text-sm",
                count_type === "zone-based"
                  ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                  : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
              )}
            >
              <input
                type="radio"
                name="count_type"
                value="zone-based"
                checked={count_type === "zone-based"}
                onChange={() => setCountType("zone-based")}
                className="sr-only"
              />
              <div className="font-medium">Zone-Based</div>
              <div className="text-xs mt-0.5 opacity-70">
                Count specific zones or sections
              </div>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this cycle count..."
            rows={3}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Link
            href="/cycle-counts"
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-400 bg-slate-900 border border-slate-700 rounded-lg hover:bg-slate-800 transition text-center"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !warehouse_id}
            className="flex-1 px-4 py-2 text-sm font-medium text-cyan-400 bg-cyan-500/15 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                Creating...
              </span>
            ) : (
              "Create & Schedule"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
