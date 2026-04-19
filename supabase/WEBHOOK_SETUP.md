# Supabase Database Webhook Setup

## Overview
This guide explains how to set up a database webhook to trigger the `sync-features` Edge Function whenever new stock movements are inserted.

## Deploy the Edge Function

```bash
# Using Supabase CLI
supabase functions deploy sync-features

# Or deploy with a specific JWT
supabase functions deploy sync-features --no-verify-jwt
```

## Create the Database Webhook

Run the following SQL in your Supabase SQL Editor:

```sql
-- ============================================================
-- Create webhook to trigger sync-features on stock_movements INSERT
-- ============================================================

SELECT pg_catalog.pg_terminate_backend(pg_stat_get_backend_pid(s.pid))

-- Create the trigger function
CREATE OR REPLACE FUNCTION notify_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
BEGIN
  -- Build payload from the new row
  payload = jsonb_build_object(
    'record', jsonb_build_object(
      'id', NEW.id,
      'product_id', NEW.product_id,
      'quantity_change', NEW.quantity_change,
      'movement_type', NEW.movement_type::text,
      'metadata', COALESCE(NEW.metadata, '{}'::jsonb),
      'created_at', NEW.created_at
    )
  );

  -- Notify the channel
  PERFORM pg_notify('stock_movement_insert', payload::text);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS stock_movement_trigger ON stock_movements;

CREATE TRIGGER stock_movement_trigger
AFTER INSERT ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION notify_stock_movement();

-- ============================================================
-- Verify the webhook is working
-- ============================================================

-- Test with a sample insert
INSERT INTO stock_movements (product_id, quantity_change, movement_type, note)
SELECT id, 10, 'in', 'test webhook'
FROM products LIMIT 1;

-- Check for notification in realtime
-- The pg_notify will emit events that Supabase can listen to
```

## Connect Webhook to Edge Function (Alternative: Database Webhooks)

If using Supabase's managed database webhooks:

```sql
-- ============================================================
-- Enable database webhooks (if available in your plan)
-- ============================================================

-- This creates a direct webhook connection
INSERT INTO supabase_functions.functions_webhooks (function_id, webhook_url, secret)
SELECT 
  (SELECT id FROM supabase_functions.functions WHERE name = 'sync-features'),
  (SELECT supabase_url || '/functions/v1/sync-features' FROM app.config),
  'your-secret-key'
ON CONFLICT DO NOTHING;
```

## Monitor Webhook Events

Check logs via Supabase CLI:

```bash
supabase functions logs sync-features --limit 50
```

## Manual Sync

You can also manually trigger a sync:

```bash
# Via HTTP
curl -X POST https://your-project.supabase.co/functions/v1/sync-features \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No events triggering | Check trigger exists: `SELECT tgname FROM pg_trigger WHERE tgname = 'stock_movement_trigger'` |
| Function timeout | Edge Functions have 10s timeout - ensure sync is fast |
| Permission denied | Grant execute on function to service role: `GRANT EXECUTE ON FUNCTION notify_stock_movement() TO service_role` |
| Webhook not firing | Check RLS policies - trigger runs with security definer |