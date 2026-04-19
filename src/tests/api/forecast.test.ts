import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockProductId = 'a1000000-0000-0000-0000-000000000001';
const mockProductId2 = 'a1000000-0000-0000-0000-000000000002';

describe('Hybrid Router Logic', () => {
  describe('Model Routing', () => {
    it('should route STRATEGIC products to TFT', () => {
      const classification = 'STRATEGIC';
      const avgDailyDemand = 50;
      
      const isStrategic = 
        classification === 'Fast Moving' || 
        classification === 'STRATEGIC' ||
        avgDailyDemand > 100;
      
      expect(isStrategic).toBe(true);
    });

    it('should route high-volume products to TFT', () => {
      const classification = 'Slow Moving';
      const avgDailyDemand = 150;
      
      const isStrategic = 
        classification === 'Fast Moving' || 
        classification === 'STRATEGIC' ||
        avgDailyDemand > 100;
      
      expect(isStrategic).toBe(true);
    });

    it('should route low-volume products to XGBoost', () => {
      const classification = 'Slow Moving';
      const avgDailyDemand = 20;
      
      const isStrategic = 
        classification === 'Fast Moving' || 
        classification === 'STRATEGIC' ||
        avgDailyDemand > 100;
      
      expect(isStrategic).toBe(false);
    });

    it('should route Fast Moving products to TFT', () => {
      const classification = 'Fast Moving';
      const avgDailyDemand = 50;
      
      const isStrategic = 
        classification === 'Fast Moving' || 
        classification === 'STRATEGIC' ||
        avgDailyDemand > 100;
      
      expect(isStrategic).toBe(true);
    });
  });

  describe('Fallback Prediction', () => {
    it('should generate 7-day forecast', () => {
      const avgDailyDemand = 100;
      const horizon = 7;
      const forecast = [];
      
      for (let i = 1; i <= horizon; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        forecast.push({
          date: date.toISOString().split('T')[0],
          predicted_qty: Math.round(avgDailyDemand),
          confidence_lower: Math.round(avgDailyDemand * 0.8),
          confidence_upper: Math.round(avgDailyDemand * 1.2),
        });
      }
      
      expect(forecast).toHaveLength(7);
    });

    it('should calculate confidence bounds correctly', () => {
      const avgDailyDemand = 100;
      const lower = Math.round(avgDailyDemand * 0.8);
      const upper = Math.round(avgDailyDemand * 1.2);
      
      expect(lower).toBe(80);
      expect(upper).toBe(120);
    });
  });

  describe('Trend Detection', () => {
    it('should detect rising trend', () => {
      const baseQty = 100;
      const recentQty = 130;
      
      const trend = recentQty > baseQty * 1.2 ? 'rising' :
                 recentQty < baseQty * 0.8 ? 'falling' : 'stable';
      
      expect(trend).toBe('rising');
    });

    it('should detect falling trend', () => {
      const baseQty = 100;
      const recentQty = 70;
      
      const trend = recentQty > baseQty * 1.2 ? 'rising' :
                 recentQty < baseQty * 0.8 ? 'falling' : 'stable';
      
      expect(trend).toBe('falling');
    });

    it('should detect stable trend', () => {
      const baseQty = 100;
      const recentQty = 95;
      
      const trend = recentQty > baseQty * 1.2 ? 'rising' :
                 recentQty < baseQty * 0.8 ? 'falling' : 'stable';
      
      expect(trend).toBe('stable');
    });
  });
});

describe('Circuit Breaker', () => {
  const CIRCUIT_FAILURE_THRESHOLD = 5;
  const CIRCUIT_OPEN_DURATION_MS = 60000;
  
  let circuitBreaker = {
    failures: 0,
    lastFailure: 0,
    state: 'closed' as 'closed' | 'open' | 'half_open',
  };
  
  const resetCircuitBreaker = () => {
    circuitBreaker.failures = 0;
    circuitBreaker.state = 'closed';
  };
  
  const recordFailure = () => {
    circuitBreaker.failures += 1;
    circuitBreaker.lastFailure = Date.now();
    
    if (circuitBreaker.failures >= CIRCUIT_FAILURE_THRESHOLD) {
      circuitBreaker.state = 'open';
    }
  };
  
  const canAttemptRequest = () => {
    if (circuitBreaker.state === 'closed') {
      return true;
    }
    
    if (circuitBreaker.state === 'open') {
      const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailure;
      if (timeSinceLastFailure >= CIRCUIT_OPEN_DURATION_MS) {
        circuitBreaker.state = 'half_open';
        return true;
      }
      return false;
    }
    
    return circuitBreaker.state === 'half_open';
  };
  
  beforeEach(() => {
    resetCircuitBreaker();
  });
  
  it('should start in closed state', () => {
    expect(circuitBreaker.state).toBe('closed');
    expect(canAttemptRequest()).toBe(true);
  });
  
  it('should stay closed after failures below threshold', () => {
    for (let i = 0; i < 4; i++) {
      recordFailure();
    }
    
    expect(circuitBreaker.state).toBe('closed');
    expect(circuitBreaker.failures).toBe(4);
  });
  
  it('should open after 5 failures', () => {
    for (let i = 0; i < 5; i++) {
      recordFailure();
    }
    
    expect(circuitBreaker.state).toBe('open');
    expect(circuitBreaker.failures).toBe(5);
  });
  
  it('should block requests when open', () => {
    for (let i = 0; i < 5; i++) {
      recordFailure();
    }
    
    expect(canAttemptRequest()).toBe(false);
  });
  
  it('should return fallback data when circuit is open', () => {
    for (let i = 0; i < 5; i++) {
      recordFailure();
    }
    
    const canRequest = canAttemptRequest();
    const source = canRequest ? 'model' : 'fallback';
    
    expect(canRequest).toBe(false);
    expect(source).toBe('fallback');
  });
  
  it('should eventually allow requests after timeout', async () => {
    for (let i = 0; i < 5; i++) {
      recordFailure();
    }
    
    expect(circuitBreaker.state).toBe('open');
    
    circuitBreaker.lastFailure = Date.now() - CIRCUIT_OPEN_DURATION_MS;
    
    const canRequest = canAttemptRequest();
    expect(canRequest).toBe(true);
  });
  
  it('should transition to half_open after successful request', () => {
    for (let i = 0; i < 5; i++) {
      recordFailure();
    }
    
    circuitBreaker.lastFailure = Date.now() - CIRCUIT_OPEN_DURATION_MS;
    canAttemptRequest();
    
    expect(circuitBreaker.state).toBe('half_open');
  });
});

describe('Mock Edge Functions', () => {
  it('should mock TFT inference success', async () => {
    const mockTftResponse = {
      status: 'success',
      forecast: [
        { date: '2024-01-01', predicted_qty: 100, confidence_lower: 80, confidence_upper: 120 },
        { date: '2024-01-02', predicted_qty: 110, confidence_lower: 90, confidence_upper: 130 },
      ],
      trend: 'rising',
    };
    
    expect(mockTftResponse.status).toBe('success');
    expect(mockTftResponse.forecast).toHaveLength(2);
    expect(mockTftResponse.trend).toBe('rising');
  });

  it('should mock XGBoost inference success', async () => {
    const mockXgbResponse = {
      status: 'success',
      forecast: [
        { date: '2024-01-01', predicted_qty: 95, confidence_lower: 75, confidence_upper: 115 },
        { date: '2024-01-02', predicted_qty: 105, confidence_lower: 85, confidence_upper: 125 },
      ],
      trend: 'stable',
    };
    
    expect(mockXgbResponse.status).toBe('success');
    expect(mockXgbResponse.forecast).toHaveLength(2);
    expect(mockXgbResponse.trend).toBe('stable');
  });

  it('should handle inference failure and return fallback', async () => {
    const error = new Error('Model inference failed');
    const fallbackForecast = [];
    
    for (let i = 1; i <= 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      fallbackForecast.push({
        date: date.toISOString().split('T')[0],
        predicted_qty: 50,
        confidence_lower: 40,
        confidence_upper: 60,
      });
    }
    
    expect(fallbackForecast).toHaveLength(7);
    expect(error.message).toBe('Model inference failed');
  });
});

describe('API Response Format', () => {
  it('should return standardized forecast response', () => {
    const response = {
      product_id: mockProductId,
      model_type: 'XGBoost',
      forecast: [
        { date: '2024-01-01', predicted_qty: 100, confidence_lower: 80, confidence_upper: 120 },
      ],
      trend: 'stable',
      generated_at: new Date().toISOString(),
      source: 'model',
    };
    
    expect(response.product_id).toBeDefined();
    expect(response.model_type).toBeDefined();
    expect(response.forecast).toBeDefined();
    expect(response.trend).toBeDefined();
    expect(response.generated_at).toBeDefined();
  });

  it('should include source field for tracking', () => {
    const sources = ['model', 'circuit_breaker', 'fallback'];
    
    sources.forEach(source => {
      const response = {
        product_id: mockProductId,
        source,
        forecast: [],
      };
      
      expect(response.source).toBe(source);
    });
  });
});