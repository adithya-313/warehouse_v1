"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Package, Grid3X3, MapPin, Clock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BinLocation, Warehouse, BinZone } from "@/lib/types";

const ZONE_COLORS: Record<BinZone, { bg: string; border: string; text: string }> = {
  A: { bg: "bg-cyan-500/20", border: "border-cyan-500/50", text: "text-cyan-400" },
  B: { bg: "bg-blue-500/20", border: "border-blue-500/50", text: "text-blue-400" },
  C: { bg: "bg-purple-500/20", border: "border-purple-500/50", text: "text-purple-400" },
  D: { bg: "bg-pink-500/20", border: "border-pink-500/50", text: "text-pink-400" },
  E: { bg: "bg-orange-500/20", border: "border-orange-500/50", text: "text-orange-400" },
  F: { bg: "bg-yellow-500/20", border: "border-yellow-500/50", text: "text-yellow-400" },
};

export default function WarehouseLayoutPage() {
  const [locations, setLocations] = useState<BinLocation[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [selectedZone, setSelectedZone] = useState<BinZone | "all">("all");
  const [selectedBin, setSelectedBin] = useState<BinLocation | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/bin-locations").then((r) => r.json()),
      fetch("/api/warehouses").then((r) => r.json()),
    ]).then(([locs, wh]) => {
      setLocations(Array.isArray(locs) ? locs : []);
      setWarehouses(Array.isArray(wh) ? wh : []);
    }).finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const filtered = locations.filter((l) =>
      (selectedWarehouse === "all" || l.warehouse_id === selectedWarehouse)
    );
    const zones = [...new Set(filtered.map((l) => l.zone))].sort() as BinZone[];
    return {
      totalBins: filtered.length,
      occupiedBins: filtered.filter((l) => l.product_id).length,
      zones,
      byZone: zones.reduce((acc, z) => {
        acc[z] = filtered.filter((l) => l.zone === z).length;
        return acc;
      }, {} as Record<string, number>),
    };
  }, [locations, selectedWarehouse]);

  const filteredLocations = useMemo(() => {
    return locations.filter((l) => {
      if (selectedWarehouse !== "all" && l.warehouse_id !== selectedWarehouse) return false;
      if (selectedZone !== "all" && l.zone !== selectedZone) return false;
      return true;
    });
  }, [locations, selectedWarehouse, selectedZone]);

  const groupedByZone = useMemo(() => {
    const groups: Record<string, typeof filteredLocations> = {};
    filteredLocations.forEach((loc) => {
      if (!groups[loc.zone]) groups[loc.zone] = [];
      groups[loc.zone].push(loc);
    });
    Object.keys(groups).forEach((z) => {
      groups[z].sort((a, b) => {
        if (a.aisle !== b.aisle) return a.aisle.localeCompare(b.aisle);
        if (a.rack !== b.rack) return a.rack.localeCompare(b.rack);
        return a.bin.localeCompare(b.bin);
      });
    });
    return groups;
  }, [filteredLocations]);

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
          <Grid3X3 className="w-5 h-5 text-cyan-400" />
          Warehouse Layout
        </h1>
        <p className="text-sm text-slate-500 mt-1">Bin locations and zone management</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-2xl font-bold text-white">{stats.totalBins}</div>
          <div className="text-sm text-slate-400">Total Bins</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-green-400">{stats.occupiedBins}</div>
          <div className="text-sm text-slate-400">Occupied</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-slate-400">{stats.totalBins - stats.occupiedBins}</div>
          <div className="text-sm text-slate-400">Empty</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-cyan-400">{stats.zones.length}</div>
          <div className="text-sm text-slate-400">Zones</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={selectedWarehouse}
          onChange={(e) => setSelectedWarehouse(e.target.value)}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
        >
          <option value="all">All Warehouses</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <select
          value={selectedZone}
          onChange={(e) => setSelectedZone(e.target.value as BinZone | "all")}
          className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-cyan-500/50"
        >
          <option value="all">All Zones</option>
          {stats.zones.map((z) => (
            <option key={z} value={z}>Zone {z}</option>
          ))}
        </select>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-medium text-white">Zone Overview</h2>
          <div className="flex gap-2 ml-auto">
            {stats.zones.map((z) => (
              <button
                key={z}
                onClick={() => setSelectedZone(selectedZone === z ? "all" : z)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium border transition",
                  selectedZone === z ? ZONE_COLORS[z].bg + " " + ZONE_COLORS[z].border + " " + ZONE_COLORS[z].text : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                )}
              >
                Zone {z} ({stats.byZone[z] || 0})
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredLocations.length === 0 ? (
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <Grid3X3 className="w-10 h-10 text-slate-600" />
          <div className="text-white font-medium">No bin locations found</div>
          <div className="text-sm text-slate-500">
            {selectedWarehouse === "all" ? "Select a warehouse to view layout" : "No bins configured for this warehouse"}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByZone).map(([zone, locs]) => {
            const color = ZONE_COLORS[zone as BinZone] || ZONE_COLORS.A;
            const aisles = [...new Set(locs.map((l) => l.aisle))].sort();

            return (
              <div key={zone} className="card p-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className={cn("px-2 py-1 rounded-lg text-sm font-bold", color.bg, color.text)}>
                    Zone {zone}
                  </span>
                  <span className="text-sm text-slate-500">{locs.length} bins</span>
                </div>
                <div className="space-y-3">
                  {aisles.map((aisle) => (
                    <div key={aisle} className="flex items-start gap-2">
                      <div className="w-8 text-xs text-slate-500 pt-1">A{aisle}</div>
                      <div className="flex gap-1 flex-wrap">
                        {locs.filter((l) => l.aisle === aisle).map((loc) => {
                          const hasProduct = !!loc.product_id;
                          const product = (loc as any).products;
                          return (
                            <button
                              key={loc.id}
                              onClick={() => setSelectedBin(loc)}
                              className={cn(
                                "w-10 h-10 rounded border text-xs font-medium transition flex items-center justify-center",
                                hasProduct
                                  ? color.bg + " " + color.border + " " + color.text
                                  : "bg-slate-800 border-slate-700 text-slate-600 hover:border-slate-600"
                              )}
                              title={hasProduct ? product?.name : "Empty"}
                            >
                              {loc.rack}{loc.bin}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedBin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedBin(null)}>
          <div className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-medium text-white mb-4">Bin Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Location</span>
                <span className="text-slate-200">
                  Zone {selectedBin.zone} / Aisle {selectedBin.aisle} / Rack {selectedBin.rack} / Bin {selectedBin.bin}
                </span>
              </div>
              {selectedBin.product_id ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Product</span>
                    <span className="text-slate-200">{(selectedBin as any).products?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Quantity</span>
                    <span className="text-green-400">{selectedBin.qty_on_hand}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Last Counted</span>
                    <span className="text-slate-400">
                      {selectedBin.last_counted ? new Date(selectedBin.last_counted).toLocaleDateString() : "Never"}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center py-4 text-slate-500">This bin is empty</div>
              )}
            </div>
            <button
              onClick={() => setSelectedBin(null)}
              className="mt-4 w-full px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
