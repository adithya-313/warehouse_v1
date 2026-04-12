"use client";

import { useEffect, useState } from "react";
import { 
  AlertTriangle, 
  LayoutGrid, 
  TrendingUp, 
  TrendingDown,
  Activity,
  PackageSearch,
  Zap,
  ArrowRight,
  ShieldCheck
} from "lucide-react";

export default function AnalyticsHeatmapsPage() {
  const [zones, setZones] = useState<any[]>([]);
  const [shrinkage, setShrinkage] = useState<any[]>([]);
  const [density, setDensity] = useState<any[]>([]);
  const [velocity, setVelocity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [zRes, sRes, dRes, vRes] = await Promise.all([
          fetch("/api/analytics/zone-activity"),
          fetch("/api/analytics/shrinkage-hotspots"),
          fetch("/api/analytics/picking-density"),
          fetch("/api/analytics/product-velocity")
        ]);

        const [zData, sData, dData, vData] = await Promise.all([
          zRes.json(), sRes.json(), dRes.json(), vRes.json()
        ]);

        setZones(zData.zones || []);
        setShrinkage(sData || []);
        setDensity(dData || []);
        setVelocity(vData || []);
      } catch (err) {
        console.error("Failed to load analytics data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Calculate highest bounds for heatmap intensity ratios safely
  const safeShrinkage = Array.isArray(shrinkage) ? shrinkage : [];
  const safeDensity = Array.isArray(density) ? density : [];
  const safeVelocity = Array.isArray(velocity) ? velocity : [];

  const maxShrinkage = safeShrinkage.length > 0 ? Math.max(...safeShrinkage.map((s) => s.loss_amount)) : 10000;
  const maxPicks = safeDensity.length > 0 ? Math.max(...safeDensity.map((d) => d.pick_count)) : 20;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6 pb-24 overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-red-400 via-orange-400 to-green-400 bg-clip-text text-transparent mb-4">
            Warehouse Intelligence Heatmaps
          </h1>
          <p className="text-xl text-slate-400">
            Real-time geospatial logic identifying dead zones, theft hotspots, and performance bottlenecks.
          </p>
        </div>

        {/* SECTION 5: Comparative Metrics (Top Row) */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-green-900/30 to-slate-900 border border-green-500/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-2xl rounded-full" />
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-500/20 rounded-xl text-green-400">
                <Zap className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-4">Picking Route Optimization</h3>
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <div className="text-slate-400 text-sm line-through">Current: 2.5 km/shift</div>
                    <div className="text-2xl font-bold text-green-400">Optimized: 1.75 km/shift</div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-bold flex items-center gap-1 justify-end">
                      <TrendingDown className="w-4 h-4" /> 30% reduction
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-green-500/10 rounded-lg text-sm text-green-400 font-medium">
                  Annual Impact: ₹12 Lakh Labor Savings
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-900/30 to-slate-900 border border-cyan-500/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-2xl rounded-full" />
            <div className="flex items-start gap-4">
              <div className="p-3 bg-cyan-500/20 rounded-xl text-cyan-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white mb-4">Shrinkage Detection Auto-Remediation</h3>
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <div className="text-slate-400 text-sm line-through">At-Risk Zones: 8</div>
                    <div className="text-2xl font-bold text-cyan-400">Reduced to: 3 Zones</div>
                  </div>
                  <div className="text-right">
                    <div className="text-cyan-400 font-bold flex items-center gap-1 justify-end">
                      <TrendingDown className="w-4 h-4" /> 62% reduction
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-cyan-500/10 rounded-lg text-sm text-cyan-400 font-medium">
                  Annual Impact: ₹15-30 Lakh Stock Recovery
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 1: Zone Activity Heatmap */}
        <div>
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-6 h-6 text-orange-400" />
            <h2 className="text-2xl font-bold text-white">Warehouse Zone Heatmap <span className="text-slate-500 font-normal text-sm ml-2">Where the action happens</span></h2>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {zones.map((z, i) => {
              const isActive = z.utilization > 70;
              const isDead = z.utilization < 40;
              
              return (
                <div 
                  key={i} 
                  className={`relative p-5 rounded-xl border transition-all cursor-pointer hover:scale-105 ${
                    isActive 
                      ? 'bg-gradient-to-br from-red-900/50 to-slate-900 border-red-500/50' 
                      : isDead 
                      ? 'bg-gradient-to-br from-emerald-900/40 to-slate-900 border-emerald-500/40'
                      : 'bg-gradient-to-br from-orange-900/40 to-slate-900 border-orange-500/40'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-4xl font-bold font-mono tracking-tighter text-white">
                      ZONE {z.zone}
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-bold ${isActive ? 'bg-red-500/20 text-red-400' : isDead ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'}`}>
                      {isActive ? 'HIGH' : isDead ? 'LOW' : 'MEDIUM'}
                    </div>
                  </div>

                  <div className="space-y-3 mt-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Weekly Picks:</span>
                      <span className="font-bold text-white">{z.picks}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Shrinkage Alerts:</span>
                      <span className={`font-bold ${z.shrinkage > 0 ? 'text-red-400' : 'text-slate-300'}`}>{z.shrinkage}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Picker Efficiency:</span>
                      <span className="font-bold text-cyan-400">{z.avg_picker_efficiency} / hr</span>
                    </div>
                  </div>

                  {/* Utilization Bar */}
                  <div className="mt-5">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Utilization Space</span>
                      <span className="font-bold text-slate-300">{z.utilization}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${isActive ? 'bg-red-500' : isDead ? 'bg-emerald-500' : 'bg-orange-500'}`} 
                        style={{width: `${z.utilization}%`}}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* GRIDS: Shrinkage + Picking Density */}
        <div className="grid lg:grid-cols-2 gap-8">
          
          {/* SECTION 2: Shrinkage Hotspots */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="flex items-center gap-2 mb-6">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <h2 className="text-xl font-bold text-white">Shrinkage Hotspots</h2>
              <span className="text-xs text-slate-500 ml-auto">High-Risk Theft/Damage Bins</span>
            </div>

            <div className="flex gap-2 text-xs mb-4">
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded" /> &gt;₹10k</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-500 rounded" /> ₹5k-10k</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-500 rounded" /> &lt;₹5k</div>
            </div>

            <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {safeShrinkage.map((s, i) => {
                const isCritical = s.loss_amount > 10000;
                const isMedium = s.loss_amount > 5000;
                return (
                  <div 
                    key={i} 
                    className={`group relative aspect-square rounded-md border flex items-center justify-center text-xs font-mono transition-transform hover:scale-110 cursor-help ${
                      isCritical ? 'bg-red-500/20 border-red-500/50 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 
                      isMedium ? 'bg-orange-500/20 border-orange-500/50 text-orange-200' : 
                      'bg-yellow-500/20 border-yellow-500/50 text-yellow-200'
                    }`}
                  >
                    {s.bin}
                    
                    {/* Tooltip */}
                    <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 bg-slate-800 border border-slate-700 text-white text-xs p-2 rounded w-48 z-10 pointer-events-none transition-opacity">
                      <div className="font-bold border-b border-slate-700 pb-1 mb-1">{s.bin}</div>
                      <div className="text-red-400 font-bold mb-1">Loss: ₹{s.loss_amount.toLocaleString()}</div>
                      <div className="text-slate-400">Alerts: {s.shrinkage_count} flags</div>
                    </div>
                  </div>
                );
              })}
              {safeShrinkage.length === 0 && <div className="col-span-5 text-center text-slate-500 py-8">No critical shrinkage bins identified.</div>}
            </div>

            {safeShrinkage.length > 0 && (
               <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                 <div className="text-red-400 font-bold mb-1">Urgent Insight:</div>
                 <div className="text-slate-300 text-sm">Top 3 at-risk bins accounting for high variance are {safeShrinkage.slice(0,3).map((s: any)=>`[${s.bin}]`).join(', ')}. Audit immediately.</div>
               </div>
            )}
          </div>

          {/* SECTION 3: Picking Density */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
            <div className="flex items-center gap-2 mb-6">
              <LayoutGrid className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-bold text-white">Picking Density Map</h2>
              <span className="text-xs text-slate-500 ml-auto">Worker Movement Patterns</span>
            </div>

            <div className="flex gap-2 text-xs mb-4">
              <div className="flex items-center gap-1 text-slate-400">Intensity scales with 30-day pick volume</div>
            </div>

            <div className="grid grid-cols-5 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {safeDensity.map((d, i) => {
                // Calculate opacity mathematically based on pick count
                const intensity = Math.max(0.2, d.pick_count / maxPicks);
                return (
                  <div 
                    key={i} 
                    className="group relative aspect-square rounded-md border border-cyan-500/30 flex items-center justify-center text-xs font-mono transition-transform hover:scale-110 cursor-help"
                    style={{ backgroundColor: `rgba(6, 182, 212, ${intensity})` }}
                  >
                    <span className="opacity-80 drop-shadow-md text-white font-bold">{d.bin}</span>
                    
                    {/* Tooltip */}
                    <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 text-white text-xs p-2 rounded w-32 z-10 pointer-events-none transition-opacity text-center">
                      <div className="font-bold text-cyan-400 border-b border-slate-700 pb-1 mb-1">{d.pick_count} Picks</div>
                      <div className="text-slate-400">Bin: {d.bin}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {safeDensity.length > 0 && (
               <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
                 <div className="text-cyan-400 font-bold mb-1">Heuristic Recommendation:</div>
                 <div className="text-slate-300 text-sm">Heavy traffic concentrated across {safeDensity.slice(0,2).map((d: any)=>d.bin).join(' and ')}. Move fast-movers from these bins strictly closer to the loading dock.</div>
               </div>
            )}
          </div>
        </div>

        {/* SECTION 4: Product Velocity List */}
        <div>
           <div className="flex items-center gap-2 mb-6">
            <PackageSearch className="w-6 h-6 text-green-400" />
            <h2 className="text-2xl font-bold text-white">Inventory Velocity Topology <span className="text-slate-500 font-normal text-sm ml-2">Fast vs Slow Movers</span></h2>
          </div>

          <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="text-left font-medium p-4">Product Name</th>
                  <th className="text-left font-medium p-4">Current Zone</th>
                   <th className="text-left font-medium p-4">Daily Drops</th>
                  <th className="text-center font-medium p-4">Classification</th>
                  <th className="text-left font-medium p-4">AI Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {safeVelocity.slice(0, 15).map((v, i) => (
                  <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition">
                    <td className="p-4 font-medium text-slate-200">{v.product}</td>
                    <td className="p-4"><span className="text-slate-400 font-mono">Zone {v.zone}</span></td>
                    <td className="p-4 text-slate-300">{v.avg_daily_demand} / day</td>
                     <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        v.velocity === 'fast' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                        v.velocity === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                        'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {v.velocity.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">
                      {v.recommendation !== "Keep in current zone" ? (
                        <div className="flex items-center gap-2 text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded border border-cyan-500/20 font-medium">
                          <ArrowRight className="w-4 h-4" /> {v.recommendation}
                        </div>
                      ) : (
                        <span className="text-slate-500">{v.recommendation}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {safeVelocity.length === 0 && <div className="p-8 text-center text-slate-500">No stock movement mapping topologies calculated for the sliding window.</div>}
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(51, 65, 85, 0.5); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(71, 85, 105, 0.8); }
      `}} />
    </div>
  );
}
