// Types for all Supabase tables

export type HealthLabel = "Healthy" | "Monitor" | "At Risk" | "Critical";
export type Classification =
  | "Fast Moving"
  | "Slow Moving"
  | "Dead Stock"
  | "Seasonal"
  | "Expiry Risk";
export type AlertSeverity = "info" | "warning" | "critical";
export type StockMovementType = "in" | "out" | "transfer";
export type SyncStatus = "success" | "partial" | "failed";
export type DemandTrend = "rising" | "stable" | "falling";

export interface Warehouse {
  id: string;
  name: string;
  location: string | null;
  capacity: number | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string | null;
  avg_lead_time_days: number;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  expiry_date: string | null;
  supplier_id: string | null;
  created_at: string;
  // Joined
  suppliers?: Supplier | null;
}

export interface Inventory {
  id: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
  reorder_point: number;
  updated_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  type: StockMovementType;
  quantity: number;
  warehouse_id: string | null;
  note: string | null;
  date: string;
}

export interface ProductAnalytics {
  id: string;
  product_id: string;
  avg_daily_demand: number;
  days_to_stockout: number | null;
  expiry_risk_score: number;
  health_score: number;
  health_label: HealthLabel;
  classification: Classification;
  demand_trend: DemandTrend;
  updated_at: string;
}

export interface Alert {
  id: string;
  product_id: string | null;
  type: string;
  severity: AlertSeverity;
  message: string;
  resolved: boolean;
  whatsapp_sent: boolean;
  created_at: string;
  // Joined
  products?: Pick<Product, "id" | "name" | "category"> | null;
  actions?: Action[];
}

export interface Action {
  id: string;
  alert_id: string;
  recommendation: string;
  created_at: string;
}

export interface SyncLog {
  id: string;
  source: string;
  status: SyncStatus;
  records_synced: number;
  error_message: string | null;
  synced_at: string;
}

// Enriched product row for the dashboard table
export interface ProductRow {
  id: string;
  name: string;
  category: string | null;
  current_stock: number;
  reorder_point: number;
  health_score: number;
  health_label: HealthLabel;
  classification: Classification;
  days_to_stockout: number | null;
  expiry_risk_score: number;
  expiry_date: string | null;
  demand_trend: DemandTrend;
  warehouse_id: string | null;
}

// Dashboard summary (top bar)
export interface DashboardSummary {
  total_products: number;
  critical_alerts: number;
  warning_alerts: number;
  warehouses_count: number;
  avg_health_score: number;
  stockout_risk_count: number;
  expiry_risk_count: number;
  dead_stock_count: number;
  last_synced_at: string | null;
  last_sync_status: SyncStatus | null;
}
