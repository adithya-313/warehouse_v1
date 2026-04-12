-- ============================================================
-- 010_gst_compliance.sql — GST Transactions & Reconciliation
-- ============================================================

-- Drop existing enums with CASCADE to recreate with correct values
DROP TYPE IF EXISTS gst_rate_type CASCADE;
DROP TYPE IF EXISTS gst_transaction_type CASCADE;
DROP TYPE IF EXISTS audit_status CASCADE;

-- GST Tax Rates Enum
CREATE TYPE gst_rate_type AS ENUM ('5', '12', '18', '28');

-- Transaction Types
CREATE TYPE gst_transaction_type AS ENUM ('inbound', 'outbound', 'transfer', 'adjustment');

-- Audit Status
CREATE TYPE audit_status AS ENUM ('pending', 'compliant', 'needs_review');

-- GST Transactions Table (append-only, immutable)
CREATE TABLE IF NOT EXISTS gst_transactions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id        UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  transaction_type    gst_transaction_type NOT NULL,
  reference_id        UUID,
  product_id          UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity            NUMERIC(12, 2) NOT NULL,
  gst_rate            NUMERIC(5, 2) NOT NULL CHECK (gst_rate IN (5, 12, 18, 28)),
  taxable_amount      NUMERIC(14, 2) NOT NULL,
  gst_amount          NUMERIC(14, 2) NOT NULL,
  invoice_number      VARCHAR(50),
  e_way_bill_number   VARCHAR(20),
  state_from          VARCHAR(2),
  state_to            VARCHAR(2),
  reconciled          BOOLEAN DEFAULT FALSE,
  reconciled_at       TIMESTAMPTZ,
  discrepancy_notes   TEXT,
  logged_by           TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE gst_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all" ON gst_transactions FOR ALL USING (true) IF NOT EXISTS;

CREATE INDEX IF NOT EXISTS idx_gst_warehouse       ON gst_transactions(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_gst_invoice         ON gst_transactions(invoice_number);
CREATE INDEX IF NOT EXISTS idx_gst_e_way_bill      ON gst_transactions(e_way_bill_number);
CREATE INDEX IF NOT EXISTS idx_gst_reconciled      ON gst_transactions(reconciled);
CREATE INDEX IF NOT EXISTS idx_gst_created         ON gst_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gst_transaction_type ON gst_transactions(transaction_type);

-- GST Reconciliation Log
CREATE TABLE IF NOT EXISTS gst_reconciliation_log (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id            UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  reconciliation_date     DATE NOT NULL,
  total_transactions      INTEGER DEFAULT 0,
  matched_count           INTEGER DEFAULT 0,
  discrepancy_count       INTEGER DEFAULT 0,
  gst_amount_variance     NUMERIC(14, 2) DEFAULT 0,
  total_taxable_amount    NUMERIC(14, 2) DEFAULT 0,
  total_gst_amount        NUMERIC(14, 2) DEFAULT 0,
  audit_status            audit_status DEFAULT 'pending',
  generated_report_path   TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, reconciliation_date)
);

ALTER TABLE gst_reconciliation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all" ON gst_reconciliation_log FOR ALL USING (true) IF NOT EXISTS;

CREATE INDEX IF NOT EXISTS idx_recon_warehouse_date ON gst_reconciliation_log(warehouse_id, reconciliation_date DESC);

-- Extend stock_movements with GST fields
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5, 2) CHECK (gst_rate IS NULL OR gst_rate IN (5, 12, 18, 28));
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(50);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS e_way_bill VARCHAR(20);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS state_code VARCHAR(2);

CREATE INDEX IF NOT EXISTS idx_stock_invoice ON stock_movements(invoice_id);
CREATE INDEX IF NOT EXISTS idx_stock_gst_rate ON stock_movements(gst_rate);

-- Add product default GST rate
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_gst_rate NUMERIC(5, 2) CHECK (default_gst_rate IS NULL OR default_gst_rate IN (5, 12, 18, 28));
