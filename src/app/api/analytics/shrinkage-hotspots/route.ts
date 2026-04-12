import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('shrinkage_alerts')
      .select('variance_qty, created_at, bin_locations(zone, aisle, rack, bin)');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const lossMap: Record<string, { bin: string, shrinkage_count: number, loss_amount: number }> = {};
    
    data?.forEach(alert => {
      // Emulating pure queries looking backward 7 days dynamically
      const date = new Date(alert.created_at || Date.now());
      if (Date.now() - date.getTime() > 7 * 24 * 60 * 60 * 1000) return;

      const bl = Array.isArray(alert.bin_locations) ? alert.bin_locations[0] : alert.bin_locations;
      if (!bl) return;
      const binId = `${bl.zone}-${bl.aisle}-${bl.rack}-${bl.bin}`;
      
      if (!lossMap[binId]) {
        lossMap[binId] = { bin: binId, shrinkage_count: 0, loss_amount: 0 };
      }
      lossMap[binId].shrinkage_count++;
      lossMap[binId].loss_amount += Math.abs(alert.variance_qty || 0) * 100; // Proxying heuristic valuation multiplier
    });

    const result = Object.values(lossMap).sort((a,b) => b.loss_amount - a.loss_amount).slice(0, 10);
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
