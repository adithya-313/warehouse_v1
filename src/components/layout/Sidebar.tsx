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
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { href: "/alerts",    label: "Alerts",     icon: Bell },
  { href: "/settings",  label: "Settings",   icon: Settings },
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
        {nav.map(({ href, label, icon: Icon }) => {
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
