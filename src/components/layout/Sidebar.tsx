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
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard",       label: "Dashboard",            icon: LayoutDashboard },
  { href: "/products",       label: "Products",             icon: Package },
  { href: "/picking",        label: "Picking",              icon: ScanLine },
  { href: "/transfers",      label: "Transfers",            icon: ArrowRightLeft },
  { href: "/cycle-counts",   label: "Cycle Counts",         icon: ClipboardList },
  { href: "/discrepancies",  label: "Discrepancies",        icon: AlertTriangle },
  { href: "/alerts",         label: "Alerts",               icon: Bell },
  { divider: true },
  { href: "/suppliers",              label: "Suppliers",              icon: Users },
  { href: "/supplier-orders",        label: "Supplier Orders",        icon: ShoppingCart },
  { href: "/suppliers/risk",         label: "Supplier Risk",          icon: ShieldAlert },
  { href: "/integrations/tally",       label: "ERP Integrations",      icon: Database },
  { divider: true },
  { href: "/forecasting",            label: "Demand Forecasting",    icon: TrendingUp },
  { href: "/liquidation-recommendations", label: "Liquidation",      icon: Percent },
  { href: "/analytics/demand-trends", label: "Demand Trends",        icon: TrendingUp },
  { href: "/analytics/stockout-risk", label: "Stockout Risk",      icon: TrendingDown },
  { href: "/analytics/executive-dashboard", label: "Executive Dashboard", icon: BarChart3 },
  { href: "/analytics/financial-impact", label: "Financial Impact", icon: BarChart3 },
  { href: "/analytics/heatmaps",     label: "Heatmaps",             icon: Zap },
  { divider: true },
  { href: "/shrinkage",            label: "Shrinkage Detection",  icon: ShieldAlert },
  { href: "/gst-compliance",       label: "GST Compliance",      icon: FileText },
  { divider: true },
  { href: "/pitch-demo",           label: "Pitch Demo",          icon: Zap },
  { divider: true },
  { href: "/settings",       label: "Settings",             icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <Warehouse className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <div className="font-bold text-sm text-white">Warehouse AI</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">MVP v1.0</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map((item, index) => {
          if ("divider" in item) {
            return <div key={`divider-${index}`} className="my-2 border-t border-slate-800" />;
          }
          const { href, label, icon: Icon } = item;
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-cyan-500/15 text-cyan-400"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Status Footer */}
      <div className="px-5 py-4 border-t border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Activity className="w-3 h-3 text-green-400" />
          <span>System Online</span>
        </div>
      </div>
    </aside>
  );
}
