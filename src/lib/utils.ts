import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, parseISO } from "date-fns";
import type { HealthLabel, AlertSeverity, Classification } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// -------------------------------------------------------------------
// Color helpers (traffic-light system)
// -------------------------------------------------------------------

export function healthColor(label: HealthLabel): string {
  switch (label) {
    case "Healthy":  return "text-green-400  bg-green-500/15  border-green-500/30";
    case "Monitor":  return "text-yellow-400 bg-yellow-500/15 border-yellow-500/30";
    case "At Risk":  return "text-orange-400 bg-orange-500/15 border-orange-500/30";
    case "Critical": return "text-red-400    bg-red-500/15    border-red-500/30";
    default:         return "text-slate-400  bg-slate-500/15  border-slate-500/30";
  }
}

export function severityColor(severity: AlertSeverity): string {
  switch (severity) {
    case "critical": return "text-red-400    bg-red-500/15    border-red-500/30";
    case "warning":  return "text-yellow-400 bg-yellow-500/15 border-yellow-500/30";
    case "info":     return "text-blue-400   bg-blue-500/15   border-blue-500/30";
    default:         return "text-slate-400  bg-slate-500/15  border-slate-500/30";
  }
}

export function classificationColor(c: Classification): string {
  switch (c) {
    case "Fast Moving":  return "text-green-300  bg-green-500/10";
    case "Slow Moving":  return "text-slate-300  bg-slate-500/10";
    case "Dead Stock":   return "text-red-300    bg-red-500/10";
    case "Seasonal":     return "text-purple-300 bg-purple-500/10";
    case "Expiry Risk":  return "text-orange-300 bg-orange-500/10";
    default:             return "text-slate-300  bg-slate-500/10";
  }
}

// Health score as a numeric color (for progress bars)
export function healthScoreGradient(score: number): string {
  if (score >= 80) return "from-green-500  to-green-400";
  if (score >= 60) return "from-yellow-500 to-yellow-400";
  if (score >= 40) return "from-orange-500 to-orange-400";
  return "from-red-500 to-red-400";
}

// -------------------------------------------------------------------
// Formatters
// -------------------------------------------------------------------

export function formatTimeAgo(isoString: string | null | undefined): string {
  if (!isoString) return "Never";
  try {
    return formatDistanceToNow(parseISO(isoString), { addSuffix: true });
  } catch {
    return "Unknown";
  }
}

export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    return new Date(isoString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Invalid";
  }
}

export function formatNumber(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: decimals });
}

export function formatDays(days: number | null | undefined): string {
  if (days === null || days === undefined) return "∞";
  if (days <= 0) return "Stockout!";
  if (days > 999) return "∞";
  return `${Math.round(days)}d`;
}
