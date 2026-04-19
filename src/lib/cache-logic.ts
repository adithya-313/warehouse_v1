import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

export type MovementCategory = 'FAST_MOVING' | 'SLOW_MOVING' | 'DEAD_STOCK';

export interface CacheConfig {
  ttl: number;
  category: MovementCategory;
}

const CACHE_TTL_MAP: Record<MovementCategory, number> = {
  FAST_MOVING: 4 * 60 * 60,
  SLOW_MOVING: 24 * 60 * 60,
  DEAD_STOCK: 7 * 24 * 60 * 60,
};

export function getCacheTTL(category: MovementCategory): number {
  return CACHE_TTL_MAP[category] || 3600;
}

export async function getProductCategory(
  productId: string
): Promise<MovementCategory> {
  try {
    const { data, error } = await supabase
      .from('product_analytics')
      .select('classification')
      .eq('product_id', productId)
      .single();

    if (error || !data) {
      return 'SLOW_MOVING';
    }

    const classification = data.classification;

    if (classification === 'Fast Moving') {
      return 'FAST_MOVING';
    } else if (classification === 'Dead Stock' || classification === 'Expiry Risk') {
      return 'DEAD_STOCK';
    }

    return 'SLOW_MOVING';
  } catch {
    return 'SLOW_MOVING';
  }
}

export class ForecastCache {
  private redisUrl: string | null;

  constructor(redisUrl?: string) {
    this.redisUrl = redisUrl || process.env.REDIS_URL || null;
  }

  private getClient() {
    return null;
  }

  async get(key: string): Promise<string | null> {
    if (!this.redisUrl) {
      return null;
    }

    try {
      const response = await fetch(`${this.redisUrl}/get/${encodeURIComponent(key)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.CACHE_SECRET}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.value || null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (!this.redisUrl) {
      return false;
    }

    try {
      const response = await fetch(`${this.redisUrl}/set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.CACHE_SECRET}`,
        },
        body: JSON.stringify({
          key,
          value,
          ttl: ttlSeconds,
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async invalidate(key: string): Promise<boolean> {
    if (!this.redisUrl) {
      return false;
    }

    try {
      const response = await fetch(
        `${this.redisUrl}/del/${encodeURIComponent(key)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${process.env.CACHE_SECRET}`,
          },
        }
      );

      return response.ok;
    } catch {
      return false;
    }
  }

  async getProductForecast(
    productId: string,
    daysAhead: number = 7
  ): Promise<{
    data: any | null;
    source: 'cache' | 'database';
  }> {
    const category = await getProductCategory(productId);
    const ttl = getCacheTTL(category);

    const cacheKey = `forecast:${productId}:${daysAhead}`;

    const cached = await this.get(cacheKey);

    if (cached) {
      return {
        data: JSON.parse(cached),
        source: 'cache',
      };
    }

    const { data, error } = await supabase
      .from('demand_forecasts')
      .select('forecast_date, predicted_qty, confidence_lower, confidence_upper')
      .eq('product_id', productId)
      .order('forecast_date')
      .limit(daysAhead);

    if (error || !data) {
      return { data: null, source: 'database' };
    }

    const cacheData = JSON.stringify(data);

    await this.set(cacheKey, cacheData, ttl);

    return {
      data,
      source: 'database',
    };
  }

  async invalidateProduct(productId: string): Promise<void> {
    const patterns = [
      `forecast:${productId}:*`,
      `features:${productId}:*`,
    ];

    for (const pattern of patterns) {
      await this.invalidate(pattern);
    }
  }
}

export const forecastCache = new ForecastCache();

export async function getForecastWithCaching(
  productId: string,
  daysAhead: number = 7
): Promise<any> {
  const category = await getProductCategory(productId);
  const ttl = getCacheTTL(category);

  const cacheKey = `forecast:${productId}:daysAhead:${daysAhead}`;

  const cachedValue = await forecastCache.get(cacheKey);

  if (cachedValue) {
    console.log(`[cache] HIT for ${productId} (${category})`);
    return {
      data: JSON.parse(cachedValue),
      source: 'cache' as const,
      category,
    };
  }

  console.log(`[cache] MISS for ${productId} (${category})`);

  const { data, error } = await supabase
    .from('demand_forecasts')
    .select('forecast_date, predicted_qty, confidence_lower, confidence_upper')
    .eq('product_id', productId)
    .eq('warehouse_id', process.env.NEXT_PUBLIC_DEFAULT_WAREHOUSE_ID || 'a1000000-0000-0000-0000-000000000001')
    .order('forecast_date')
    .limit(daysAhead);

  if (error || !data || data.length === 0) {
    return {
      data: null,
      source: 'database' as const,
      category,
    };
  }

  await forecastCache.set(cacheKey, JSON.stringify(data), ttl);

  return {
    data,
    source: 'database' as const,
    category,
  };
}

export async function invalidateForecastCache(
  productId: string
): Promise<void> {
  await forecastCache.invalidateProduct(productId);
  console.log(`[cache] Invalidated cache for ${productId}`);
}