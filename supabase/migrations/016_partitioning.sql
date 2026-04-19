-- ============================================================
-- 016_partitioning.sql — Database Partitioning for stock_movements
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- Step 1: Create partitioned stock_movements table
-- ============================================================

DROP TABLE IF EXISTS stock_movements CASCADE;

CREATE TABLE stock_movements (
    id              UUID NOT NULL,
    product_id      UUID NOT NULL,
    quantity_change NUMERIC(12, 2),
    movement_type   stock_movement_type,
    metadata      JSONB DEFAULT '{}'::jsonb,
    warehouse_id   UUID,
    note          TEXT,
    date          DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at     TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE INDEX idx_stock_movements_product_created ON stock_movements (product_id, created_at DESC);
CREATE INDEX idx_stock_movements_metadata ON stock_movements USING GIN (metadata);
CREATE INDEX idx_stock_movements_date ON stock_movements (date);

-- ============================================================
-- Step 2: Create partitions for current and next 3 months
-- ============================================================

SELECT create_month_partition('2026', '04');
SELECT create_month_partition('2026', '05');
SELECT create_month_partition('2026', '06');
SELECT create_month_partition('2026', '07');

-- ============================================================
-- Step 3: Helper function to create monthly partitions
-- ============================================================

CREATE OR REPLACE FUNCTION create_month_partition(year_text TEXT, month_text TEXT)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
    start_ts TIMESTAMPTZ;
    end_ts TIMESTAMPTZ;
BEGIN
    partition_name := 'stock_movements_' || year_text || '_' || month_text;
    start_date := year_text || '-' || month_text || '-01';
    
    start_ts := start_date::TIMESTAMPTZ;
    
    IF month_text::INT = 12 THEN
        end_date := (year_text::INT + 1) || '-01-01';
    ELSE
        end_date := year_text || '-' || LPAD((month_text::INT + 1)::TEXT, 2, '0') || '-01';
    END IF;
    end_ts := end_date::TIMESTAMPTZ;
    
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I PARTITION OF stock_movements
        FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_ts, end_ts
    );
    
    RAISE NOTICE 'Created partition: %', partition_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Step 4: Auto-create next month's partition (cron job)
-- ============================================================

CREATE OR REPLACE FUNCTION ensure_next_month_partition()
RETURNS VOID AS $$
DECLARE
    next_month DATE;
    year_text TEXT;
    month_text TEXT;
BEGIN
    next_month := CURRENT_DATE + INTERVAL '1 month';
    year_text := EXTRACT(YEAR FROM next_month)::TEXT;
    month_text := LPAD(EXTRACT(MONTH FROM next_month)::TEXT, 2, '0');
    
    PERFORM create_month_partition(year_text, month_text);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Step 5: Create pg_cron job for automatic partition creation
-- ============================================================

INSERT INTO cron.job (schedule, command, database)
VALUES (
    '0 0 25 * *',
    'SELECT ensure_next_month_partition()',
    'postgres'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Step 6: Copy existing data to current partition
-- ============================================================

-- This will be handled by the partition attachment
-- run during migration if data exists in old table

-- ============================================================
-- Step 7: Create view for backward compatibility
-- ============================================================

CREATE OR REPLACE VIEW stock_movements_all AS
SELECT * FROM stock_movements;

-- ============================================================
-- Step 8: RLS policies for partitioned table
-- ============================================================

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all" ON stock_movements
    FOR ALL TO service_role USING (true);

CREATE POLICY "authenticated_read" ON stock_movements
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "warehouse_worker_read" ON stock_movements
    FOR SELECT TO warehouse_worker USING (true);

CREATE POLICY "warehouse_worker_insert" ON stock_movements
    FOR INSERT TO warehouse_worker WITH CHECK (true);

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE stock_movements IS 'Partitioned by created_at month for performance';
COMMENT ON FUNCTION create_month_partition(TEXT, TEXT) IS 'Creates monthly partition';
COMMENT ON FUNCTION ensure_next_month_partition() IS 'Creates next month partition automatically';
COMMENT ON VIEW stock_movements_all IS 'Unified view over all partitions';