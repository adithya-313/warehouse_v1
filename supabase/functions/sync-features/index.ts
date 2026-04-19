import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@1.35.7";

interface StockMovementRecord {
  id: string;
  product_id: string;
  quantity_change: number;
  movement_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface FeatureUpdate {
  product_id: string;
  feature_date: string;
  rolling_avg_7d: number;
  rolling_avg_14d: number;
  rolling_avg_30d: number;
  category_velocity: number;
  product_velocity: number;
  day_of_week: number;
  is_holiday: boolean;
  is_weekend: boolean;
  is_month_end: boolean;
  is_month_start: boolean;
  lag_1d: number;
  lag_7d: number;
  lag_14d: number;
  metadata: Record<string, unknown>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HOLIDAYS = new Set([
  "01-01", "01-26", "08-15", "10-02", "10-20", "10-21", "11-01", "12-25",
]);

function isHoliday(date: Date): boolean {
  const monthDay = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return HOLIDAYS.has(monthDay);
}

function getDayOfWeek(date: Date): number {
  return date.getDay();
}

function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function isMonthEnd(date: Date): boolean {
  const testDate = new Date(date);
  testDate.setMonth(testDate.getMonth() + 1);
  testDate.setDate(0);
  return date.getDate() === testDate.getDate();
}

function isMonthStart(date: Date): boolean {
  return date.getDate() === 1;
}

async function fetchDemandData(
  supabase: ReturnType<typeof createClient>,
  productId: string,
  days: number
): Promise<Array<{ date: string; net_quantity: number }>> {
  const { data, error } = await supabase
    .from("daily_demand_timeseries")
    .select("date, net_quantity")
    .eq("product_id", productId)
    .order("date", { ascending: false })
    .limit(days);

  if (error || !data) {
    console.error("Error fetching demand data:", error);
    return [];
  }

  return data.map((row) => ({
    date: row.date,
    net_quantity: row.net_quantity ?? 0,
  }));
}

function calculateRollingAverage(values: number[], window: number): number {
  if (values.length === 0) return 0;
  const windowValues = values.slice(0, window);
  const sum = windowValues.reduce((a, b) => a + b, 0);
  return sum / windowValues.length;
}

async function updateMlFeatureStore(
  supabase: ReturnType<typeof createClient>,
  featureUpdate: FeatureUpdate
): Promise<void> {
  const { error } = await supabase
    .from("ml_feature_store")
    .upsert(
      {
        product_id: featureUpdate.product_id,
        feature_date: featureUpdate.feature_date,
        rolling_avg_7d: featureUpdate.rolling_avg_7d,
        rolling_avg_14d: featureUpdate.rolling_avg_14d,
        rolling_avg_30d: featureUpdate.rolling_avg_30d,
        category_velocity: featureUpdate.category_velocity,
        product_velocity: featureUpdate.product_velocity,
        day_of_week: featureUpdate.day_of_week,
        is_holiday: featureUpdate.is_holiday,
        is_weekend: featureUpdate.is_weekend,
        is_month_end: featureUpdate.is_month_end,
        is_month_start: featureUpdate.is_month_start,
        lag_1d: featureUpdate.lag_1d,
        lag_7d: featureUpdate.lag_7d,
        lag_14d: featureUpdate.lag_14d,
        metadata: featureUpdate.metadata,
        created_at: new Date().toISOString(),
      },
      { onConflict: "product_id,feature_date" }
    );

  if (error) {
    console.error("Error updating ml_feature_store:", error);
    throw error;
  }
}

async function getCategoryVelocity(
  supabase: ReturnType<typeof createClient>,
  productId: string
): Promise<number> {
  const { data: product } = await supabase
    .from("products")
    .select("category")
    .eq("id", productId)
    .single();

  if (!product?.category) return 0;

  const { data } = await supabase
    .from("daily_demand_timeseries")
    .select("net_quantity")
    .eq("category", product.category)
    .order("date", { ascending: false })
    .limit(7);

  if (!data || data.length === 0) return 0;
  return data.reduce((sum, row) => sum + (row.net_quantity ?? 0), 0) / 7;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let payload: { record: StockMovementRecord } | { records: StockMovementRecord[] };

    try {
      payload = await req.json();
    } catch {
      payload = { records: [] };
    }

    let records: StockMovementRecord[] = [];

    if ("record" in payload) {
      records = [payload.record];
    } else if ("records" in payload) {
      records = payload.records;
    } else if (req.method === "POST") {
      const { data } = await supabase
        .from("stock_movements")
        .select("id, product_id, quantity_change, movement_type, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      records = (data || []).map((row) => ({
        id: row.id,
        product_id: row.product_id,
        quantity_change: row.quantity_change,
        movement_type: row.movement_type,
        metadata: row.metadata || {},
        created_at: row.created_at,
      }));
    }

    if (records.length === 0) {
      return new Response(
        JSON.stringify({ status: "no_records", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const processedProducts = new Set<string>();
    let featureCount = 0;

    for (const record of records) {
      if (!record.product_id || processedProducts.has(record.product_id)) {
        continue;
      }
      processedProducts.add(record.product_id);

      const recordDate = record.created_at
        ? new Date(record.created_at)
        : new Date();
      const dateStr = recordDate.toISOString().split("T")[0];

      const demandData7d = await fetchDemandData(supabase, record.product_id, 7);
      const demandData14d = await fetchDemandData(supabase, record.product_id, 14);
      const demandData30d = await fetchDemandData(supabase, record.product_id, 30);

      const values7d = demandData7d.map((d) => d.net_quantity);
      const values14d = demandData14d.map((d) => d.net_quantity);
      const values30d = demandData30d.map((d) => d.net_quantity);

      const categoryVelocity = await getCategoryVelocity(
        supabase,
        record.product_id
      );

      const featureUpdate: FeatureUpdate = {
        product_id: record.product_id,
        feature_date: dateStr,
        rolling_avg_7d: calculateRollingAverage(values7d, 7),
        rolling_avg_14d: calculateRollingAverage(values14d, 14),
        rolling_avg_30d: calculateRollingAverage(values30d, 30),
        category_velocity: categoryVelocity,
        product_velocity: categoryVelocity,
        day_of_week: getDayOfWeek(recordDate),
        is_holiday: isHoliday(recordDate),
        is_weekend: isWeekend(recordDate),
        is_month_end: isMonthEnd(recordDate),
        is_month_start: isMonthStart(recordDate),
        lag_1d: values7d[0] || 0,
        lag_7d: values7d[6] || 0,
        lag_14d: values14d[13] || 0,
        metadata: record.metadata || {},
      };

      await updateMlFeatureStore(supabase, featureUpdate);
      featureCount++;

      console.log(
        `[sync-features] Updated features for product ${record.product_id} on ${dateStr}`
      );
    }

    return new Response(
      JSON.stringify({
        status: "success",
        processed: records.length,
        features_updated: featureCount,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[sync-features] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});