import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

export type AlertType = 
  | 'TALLY_SYNC_FAILURE'
  | 'CIRCUIT_BREAKER_OPEN'
  | 'MODEL_TRAINING_FAILURE'
  | 'HIGH_DRIFT'
  | 'SYSTEM';

export interface AlertPayload {
  alert_type: AlertType;
  message: string;
  severity: 'warning' | 'critical';
  metadata?: Record<string, any>;
}

const SEVERITY_THRESHOLDS: Record<AlertType, 'warning' | 'critical'> = {
  TALLY_SYNC_FAILURE: 'critical',
  CIRCUIT_BREAKER_OPEN: 'warning',
  MODEL_TRAINING_FAILURE: 'critical',
  HIGH_DRIFT: 'warning',
  SYSTEM: 'warning',
};

export async function sendAlert(payload: AlertPayload): Promise<boolean> {
  try {
    const { error } = await supabase.from('alert_notifications').insert({
      product_id: payload.metadata?.product_id || 'SYSTEM',
      alert_type: payload.alert_type,
      severity: payload.severity,
      message: payload.message,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[notifications] Failed to save alert:', error);
      return false;
    }

    if (process.env.WATI_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL) {
      await sendToWebhook(payload);
    }

    return true;
  } catch (err) {
    console.error('[notifications] Error:', err);
    return false;
  }
}

async function sendToWebhook(payload: AlertPayload): Promise<boolean> {
  const webhookUrl = process.env.WATI_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    return false;
  }

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${payload.alert_type}* :${payload.severity === 'critical' ? 'rotating_light' : 'warning'}:\n${payload.message}`,
      },
    },
  ];

  if (payload.metadata) {
    const fields = Object.entries(payload.metadata).map(([key, value]) => ({
      type: 'mrkdwn' as const,
      text: `*${key}:*\n${value}`,
    }));

    blocks.push({
      type: 'section',
      fields: fields.slice(0, 10),
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });

    return response.ok;
  } catch (err) {
    console.error('[notifications] Webhook error:', err);
    return false;
  }
}

export async function checkTallySync(): Promise<boolean> {
  const SIX_HOURS_AGO = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('sync_logs')
    .select('synced_at')
    .gte('synced_at', SIX_HOURS_AGO)
    .order('synced_at', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    await sendAlert({
      alert_type: 'TALLY_SYNC_FAILURE',
      message: 'Tally sync has not occurred in > 6 hours',
      severity: 'critical',
      metadata: { last_sync: data?.[0]?.synced_at || 'never' },
    });
    return false;
  }

  return true;
}

export async function checkCircuitBreaker(): Promise<boolean> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/api/ml/forecast/status`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ action: 'status' }),
      }
    );

    if (!response.ok) {
      return true;
    }

    const state = await response.json();

    if (state.state === 'open') {
      await sendAlert({
        alert_type: 'CIRCUIT_BREAKER_OPEN',
        message: 'ML Inference Circuit Breaker is OPEN',
        severity: 'warning',
        metadata: { failures: state.failures },
      });
      return false;
    }

    return true;
  } catch {
    return true;
  }
}

export async function notifyTrainingFailure(error: string): Promise<void> {
  await sendAlert({
    alert_type: 'MODEL_TRAINING_FAILURE',
    message: `ML Training failed: ${error}`,
    severity: 'critical',
    metadata: { error },
  });
}

export async function notifyDriftAlert(productId: string, mape: number): Promise<void> {
  await sendAlert({
    alert_type: 'HIGH_DRIFT',
    message: `High drift detected for product ${productId}: MAPE ${mape}%`,
    severity: 'warning',
    metadata: { product_id: productId, mape: mape.toString() },
  });
}

export async function runHealthChecks(): Promise<void> {
  console.log('[notifications] Running health checks...');

  await checkTallySync();

  await checkCircuitBreaker();

  console.log('[notifications] Health checks complete');
}

if (require.main === module) {
  runHealthChecks().catch(console.error);
}