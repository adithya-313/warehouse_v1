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
export type LiquidationAction = "liquidate_discount" | "transfer_to_hub" | "return_to_supplier" | "bundle_promotion";
export type UrgencyLevel = "low" | "medium" | "high";
export type DaysAhead = 30 | 60 | 90;

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
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  avg_lead_time_days: number;
  payment_terms: number;
  category: SupplierCategory;
  rating: number | null;
  status: SupplierStatus;
  created_at: string;
}

export type SupplierCategory = "primary" | "secondary" | "emergency";
export type SupplierStatus = "active" | "inactive";

export interface SupplierOrder {
  id: string;
  supplier_id: string;
  product_id: string;
  order_date: string;
  expected_delivery: string;
  actual_delivery: string | null;
  ordered_qty: number;
  received_qty: number | null;
  unit_cost: number;
  total_cost: number | null;
  on_time: boolean | null;
  quality_issues: boolean;
  status: "pending" | "received" | "cancelled";
  logged_by: string | null;
  received_by: string | null;
  created_at: string;
  updated_at: string;
  suppliers?: Pick<Supplier, "id" | "name"> | null;
  products?: Pick<Product, "id" | "name" | "category"> | null;
}

export interface SupplierPerformance {
  id: string;
  supplier_id: string;
  on_time_delivery_pct: number;
  quality_score: number;
  avg_lead_time_days: number;
  last_30_days_orders: number;
  total_cost_30_days: number;
  reliability_score: number;
  updated_at: string;
  suppliers?: Pick<Supplier, "id" | "name" | "rating" | "category" | "status"> | null;
}

export interface SupplierWithPerformance extends Supplier {
  performance?: SupplierPerformance;
}

export interface SupplierOrderRow extends SupplierOrder {
  supplier_name?: string;
  product_name?: string;
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
  reserved_qty: number;
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

// ============================================================
// CYCLE COUNTING TYPES
// ============================================================
export type CycleCountStatus = "scheduled" | "in-progress" | "completed";
export type CycleCountType = "full" | "zone-based";
export type CycleCountItemStatus = "pending" | "counted" | "verified";
export type DiscrepancyRootCause = "damage" | "shrinkage" | "data_entry_error" | "supplier_short" | "other";

export interface CycleCount {
  id: string;
  warehouse_id: string;
  status: CycleCountStatus;
  scheduled_date: string;
  completed_date: string | null;
  started_at: string | null;
  created_by: string | null;
  notes: string | null;
  count_type: CycleCountType;
  created_at: string;
  // Joined
  warehouses?: Pick<Warehouse, "id" | "name" | "location"> | null;
}

export interface CycleCountItem {
  id: string;
  cycle_count_id: string;
  product_id: string;
  warehouse_id: string;
  expected_qty: number;
  actual_qty: number | null;
  variance: number | null;
  variance_pct: number | null;
  discrepancy_flag: boolean;
  status: CycleCountItemStatus;
  counted_by: string | null;
  counted_at: string | null;
  created_at: string;
  // Joined
  products?: Pick<Product, "id" | "name" | "category" | "unit"> | null;
}

export interface InventoryDiscrepancy {
  id: string;
  product_id: string;
  warehouse_id: string;
  cycle_count_id: string;
  expected_qty: number;
  actual_qty: number;
  variance: number;
  variance_pct: number;
  root_cause: DiscrepancyRootCause;
  resolved: boolean;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  // Joined
  products?: Pick<Product, "id" | "name" | "category"> | null;
  warehouses?: Pick<Warehouse, "id" | "name"> | null;
  cycle_counts?: Pick<CycleCount, "id" | "scheduled_date"> | null;
}

export interface CycleCountProgress {
  total_items: number;
  counted: number;
  pending: number;
  verified: number;
  variance_count: number;
  avg_variance_pct: number;
}

export interface CycleCountSummary {
  cycle_count: CycleCount;
  progress: CycleCountProgress;
  variance_summary: {
    total_variance_units: number;
    flagged_items: number;
  };
}

export interface CycleCountRow extends CycleCount {
  total_items: number;
  counted_items: number;
  flagged_items: number;
  variance_count: number;
}

// ============================================================
// TRANSFER TYPES
// ============================================================
export type TransferStatus = "draft" | "approved" | "in-transit" | "received" | "cancelled";
export type TransferReason = "rebalance" | "dead_stock_redistribution" | "demand_shift" | "supplier_consolidation" | "other";
export type TransferItemStatus = "pending" | "shipped" | "received" | "rejected";
export type TransferAction = "created" | "approved" | "shipped" | "received" | "cancelled" | "item_updated" | "item_received";

export interface Transfer {
  id: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  status: TransferStatus;
  created_by: string | null;
  approved_by: string | null;
  shipped_by: string | null;
  received_by: string | null;
  initiated_date: string;
  approved_date: string | null;
  shipped_date: string | null;
  received_date: string | null;
  notes: string | null;
  transfer_reason: TransferReason;
  cancelled_at: string | null;
  cancel_reason: string | null;
  deleted_at: string | null;
  created_at: string;
  // Joined
  from_warehouse?: Pick<Warehouse, "id" | "name" | "location"> | null;
  to_warehouse?: Pick<Warehouse, "id" | "name" | "location"> | null;
}

export interface TransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  requested_qty: number;
  shipped_qty: number | null;
  received_qty: number | null;
  variance: number | null;
  variance_pct: number | null;
  status: TransferItemStatus;
  rejection_reason: string | null;
  created_at: string;
  // Joined
  products?: Pick<Product, "id" | "name" | "category" | "unit"> | null;
}

export interface TransferAuditLog {
  id: string;
  transfer_id: string;
  action: TransferAction;
  performed_by: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface TransferRow extends Transfer {
  total_items: number;
  shipped_items: number;
  received_items: number;
  total_requested: number;
  total_shipped: number;
  total_received: number;
  variance_count: number;
}

export interface TransferWithItems extends Transfer {
  items: TransferItem[];
  audit_log?: TransferAuditLog[];
}

export interface StockLevelReserved {
  product_id: string;
  warehouse_id: string;
  product_name: string;
  category: string | null;
  unit: string;
  current_qty: number;
  reserved_qty: number;
  available_qty: number;
}

// ============================================================
// PICKING TYPES
// ============================================================
export type PickBatchStatus = "draft" | "assigned" | "in-progress" | "completed";
export type PickItemStatus = "pending" | "picked" | "verified";
export type BinZone = "A" | "B" | "C" | "D" | "E" | "F";
export type PickAction = "created" | "assigned" | "started" | "item_picked" | "item_verified" | "completed" | "cancelled";

export interface BinLocation {
  id: string;
  warehouse_id: string;
  aisle: string;
  rack: string;
  bin: string;
  zone: BinZone;
  product_id: string | null;
  qty_on_hand: number;
  last_counted: string | null;
  created_at: string;
  // Joined
  products?: Pick<Product, "id" | "name" | "category" | "unit"> | null;
  warehouses?: Pick<Warehouse, "id" | "name"> | null;
}

export interface PickBatch {
  id: string;
  warehouse_id: string;
  status: PickBatchStatus;
  created_date: string;
  completed_date: string | null;
  started_at: string | null;
  picker_id: string | null;
  total_items: number;
  total_picks_completed: number;
  efficiency_score: number | null;
  order_ids: string[] | null;
  notes: string | null;
  created_at: string;
  // Joined
  warehouses?: Pick<Warehouse, "id" | "name"> | null;
}

export interface PickBatchItem {
  id: string;
  pick_batch_id: string;
  product_id: string;
  location_id: string | null;
  requested_qty: number;
  picked_qty: number;
  status: PickItemStatus;
  sequence_order: number | null;
  picked_by: string | null;
  picked_at: string | null;
  created_at: string;
  // Joined
  products?: Pick<Product, "id" | "name" | "category" | "unit"> | null;
  bin_locations?: Pick<BinLocation, "id" | "aisle" | "rack" | "bin" | "zone"> | null;
}

export interface PickAuditLog {
  id: string;
  pick_batch_id: string | null;
  pick_item_id: string | null;
  action: PickAction;
  performed_by: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface PickBatchRow extends PickBatch {
  picked_count: number;
  pending_count: number;
  progress_pct: number;
  current_zone: BinZone | null;
}

export interface PickBatchWithItems extends PickBatch {
  items: PickBatchItem[];
  audit_log?: PickAuditLog[];
}

export interface OptimizedRoute {
  items: PickBatchItem[];
  total_zones: BinZone[];
  estimated_distance: number;
  zone_transitions: number;
}

export interface PickerPerformance {
  picker_id: string;
  total_batches: number;
  total_items: number;
  total_picks: number;
  avg_efficiency: number;
  avg_batch_time_minutes: number;
  accuracy: number;
}

// ============================================================
// DEMAND FORECASTING TYPES
// ============================================================

export interface DemandForecast {
  id: string;
  product_id: string;
  warehouse_id: string;
  forecast_date: string;
  days_ahead: DaysAhead;
  predicted_qty: number;
  confidence_lower: number;
  confidence_upper: number;
  confidence_score: number;
  trend: DemandTrend;
  created_at: string;
  // Joined
  products?: Pick<Product, "id" | "name" | "category" | "unit"> | null;
  warehouses?: Pick<Warehouse, "id" | "name" | "location"> | null;
}

export interface LiquidationRecommendation {
  id: string;
  product_id: string;
  warehouse_id: string;
  current_qty: number;
  days_to_expiry: number | null;
  recommended_action: LiquidationAction;
  discount_pct: number;
  urgency_level: UrgencyLevel;
  estimated_revenue_loss: number;
  created_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  // Joined
  products?: Pick<Product, "id" | "name" | "category" | "unit"> | null;
  warehouses?: Pick<Warehouse, "id" | "name" | "location"> | null;
}

export interface ForecastSummary {
  total_products: number;
  forecasted: number;
  errors: number;
  rising: number;
  stable: number;
  falling: number;
  avg_confidence: number;
  warehouse_id?: string;
  last_run?: string;
}

export interface ForecastRow extends DemandForecast {
  current_qty: number;
  avg_daily_demand: number;
  pred_30: number;
  pred_60: number;
  pred_90: number;
  confidence_30: number;
  confidence_60: number;
  confidence_90: number;
}

export interface DemandTrendData {
  historical: { date: string; quantity: number }[];
  forecast: { date: string; predicted: number; lower: number; upper: number }[];
  trend: DemandTrend;
}

export interface OverstockItem {
  product_id: string;
  product_name: string;
  category: string | null;
  current_qty: number;
  days_supply: number;
  predicted_qty_30: number;
  recommended_discount: number;
  urgency_level: UrgencyLevel;
  capital_tied_up: number;
  estimated_revenue_loss: number;
}
