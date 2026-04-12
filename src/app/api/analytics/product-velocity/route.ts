import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data: inv, error } = await supabase
      .from('inventory')
      .select('product_id, primary_bin_location_id, products(name), bin_locations(zone)');
      
    const { data: moves } = await supabase
      .from('stock_movements')
      .select('product_id, quantity, type, date')
      .eq('type', 'out');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const moveMap: Record<string, number> = {};
    
    moves?.forEach(m => {
      // only count trailing last 30 days proxy to isolate velocities
      const date = new Date(m.date);
      if (Date.now() - date.getTime() <= 30 * 24 * 60 * 60 * 1000) {
        moveMap[m.product_id] = (moveMap[m.product_id] || 0) + (m.quantity || 0);
      }
    });

    const result = (inv || []).map(i => {
      const avg = Math.round((moveMap[i.product_id] || 0) / 30);
      
      // Override velocity with logic mappings
      let velocity = 'slow';
      if (avg > 10) velocity = 'fast';
      else if (avg > 5) velocity = 'medium';
      
      const p = Array.isArray(i.products) ? i.products[0] : i.products;
      const bl = Array.isArray(i.bin_locations) ? i.bin_locations[0] : i.bin_locations;
      
      const zone = bl?.zone || 'Unknown';
      let rec = 'Keep in current zone';
      if (velocity === 'fast' && zone !== 'A') rec = `Move to Zone A`;
      if (velocity === 'slow' && zone === 'A') rec = `Move out of Zone A to C/D`;

      return {
        product: p?.name || 'Unknown Item',
        zone: zone,
        avg_daily_demand: avg,
        velocity: velocity,
        recommendation: rec
      };
    }).sort((a,b) => b.avg_daily_demand - a.avg_daily_demand);

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
