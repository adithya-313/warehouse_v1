"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bell,
  Package,
  Settings,
  Warehouse,
  Activity,
  ClipboardList,
  AlertTriangle,
  ArrowRightLeft,
  ScanLine,
  TrendingUp,
  TrendingDown,
  Percent,
  Users,
  ShoppingCart,
  ShieldAlert,
  FileText,
  Zap,
  BarChart3,
  Database,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Grouped navigation structure
const NAV_GROUPS = [
  {
    group: "OPERATIONS",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/products", label: "Inventory", icon: Package },
      { href: "/picking", label: "Pick Batches", icon: ScanLine },
      { href: "/transfers", label: "Transfers", icon: ArrowRightLeft },
      { href: "/cycle-counts", label: "Cycle Counts", icon: ClipboardList },
      { href: "/discrepancies", label: "Discrepancies", icon: AlertTriangle },
      { href: "/alerts", label: "Alerts", icon: Bell },
    ],
  },
  {
    group: "INTELLIGENCE",
    items: [
      { href: "/forecasting", label: "Demand Forecasting", icon: TrendingUp },
      { href: "/suppliers/risk", label: "Supplier Risk", icon: ShieldAlert },
      { href: "/analytics/demand-trends", label: "Demand Trends", icon: TrendingDown },
      { href: "/analytics/stockout-risk", label: "Stockout Risk", icon: BarChart3 },
      { href: "/analytics/heatmaps", label: "Heatmaps", icon: Zap },
    ],
  },
  {
    group: "SUPPLIERS",
    items: [
      { href: "/suppliers", label: "Supplier Master", icon: Users },
      { href: "/supplier-orders", label: "Purchase Orders", icon: ShoppingCart },
    ],
  },
  {
    group: "COMPLIANCE",
    items: [
      { href: "/shrinkage", label: "Shrinkage Detection", icon: ShieldAlert },
      { href: "/gst-compliance", label: "GST Compliance", icon: FileText },
    ],
  },
  {
    group: "SYSTEM",
    items: [
      { href: "/integrations/tally", label: "ERP Integrations", icon: Database },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="h-[100dvh] flex flex-col bg-slate-900 text-slate-300 border-r border-slate-800">
      {/* Header (Fixed) */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <Warehouse className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <div className="font-bold text-sm text-white">Warehouse AI</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">MVP v1.0</div>
        </div>
      </div>

      {/* Nav Body (Scrollable) */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 pb-4">
        <div className="p-3 space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.group}>
              {/* Category Header */}
              <span className="text-xs font-semibold text-slate-500 tracking-wider px-3 block mb-2">
                {group.group}
              </span>

              {/* Group Items */}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ease-in-out",
                        active
                          ? "bg-cyan-500/10 text-cyan-400 font-medium"
                          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* Footer (Fixed) */}
      <div className="px-5 py-4 border-t border-slate-800 shrink-0">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ease-in-out",
            pathname.startsWith("/settings")
              ? "bg-cyan-500/10 text-cyan-400 font-medium"
              : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          )}
        >
          <User className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">Admin Profile</span>
        </Link>

        <div className="flex items-center gap-2 text-xs text-slate-500 mt-3 px-3">
          <Activity className="w-3 h-3 text-green-400" />
          <span>System Online</span>
        </div>
      </div>
    </aside>
  );
}