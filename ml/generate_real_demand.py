"""
Data Realism Patch - Poisson/Zero-Inflation/Holiday Spikes
Realistic ML training data generation
"""

import random
import math
from datetime import datetime, timedelta
from typing import List, Tuple

import numpy as np
import pandas as pd

class DataRealismPatch:
    def __init__(self, seed: int = 42):
        random.seed(seed)
        np.random.seed(seed)
        
    def generate_poisson_demand(self, mean: float, n_days: int) -> List[int]:
        """Generate demand using Poisson distribution"""
        return [np.random.poisson(mean) for _ in range(n_days)]
    
    def generate_zero_inflated(self, mean: float, zero_prob: float, n_days: int) -> List[int]:
        """Generate demand with zero-inflation (slow-moving items)"""
        result = []
        for _ in range(n_days):
            if random.random() < zero_prob:
                result.append(0)
            else:
                result.append(np.random.poisson(mean))
        return result
    
    def apply_holiday_spike(self, base_demand: int, holiday_multiplier: float) -> int:
        """Apply spike multiplier for holiday periods"""
        return int(base_demand * holiday_multiplier)
    
    def generate_weekly_pattern(self, base_demand: int) -> List[int]:
        """Generate weekly demand pattern (weekends higher)"""
        pattern = []
        for day in range(7):
            if day >= 5:
                pattern.append(int(base_demand * 1.3))
            else:
                pattern.append(base_demand)
        return pattern
    
    def generate_realistic_demand(
        self,
        n_products: int,
        n_days: int,
        zero_inflation_rate: float = 0.3,
        holiday_spike_days: List[str] = None
    ) -> pd.DataFrame:
        """Generate realistic demand data with all patterns"""
        
        if holiday_spike_days is None:
            holiday_spike_days = ['2026-11-01', '2026-03-25', '2026-08-15']
        
        records = []
        
        holidays_set = set(holiday_spike_days)
        
        for product_id in range(n_products):
            base_mean = np.random.exponential(50) + 10
            
            for day_offset in range(n_days):
                date = datetime(2025, 1, 1) + timedelta(days=day_offset)
                date_str = date.strftime('%Y-%m-%d')
                
                zero_inflation = random.random() < zero_inflation_rate
                
                if zero_inflation:
                    demand = 0
                else:
                    day_of_week = date.weekday()
                    
                    if day_of_week >= 5:
                        demand = int(base_mean * np.random.uniform(1.1, 1.4))
                    else:
                        demand = int(base_mean * np.random.uniform(0.8, 1.2))
                    
                    if date_str in holidays_set:
                        demand = self.apply_holiday_spike(demand, 2.5)
                    
                    demand = max(0, demand + np.random.randint(-5, 6))
                
                weekday_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                
                records.append({
                    'product_id': f'P{product_id:04d}',
                    'date': date_str,
                    'net_quantity': demand,
                    'category': 'FMCG',
                    'is_holiday': date_str in holidays_set,
                    'day_of_week': weekday_names[day_of_week]
                })
        
        return pd.DataFrame(records)


def generate_test_data(output_path: str = None):
    patch = DataRealismPatch()
    
    df = patch.generate_realistic_demand(
        n_products=50,
        n_days=365,
        zero_inflation_rate=0.25,
        holiday_spike_days=['2025-11-01', '2025-03-25', '2025-08-15', '2025-01-26']
    )
    
    print(f"Generated {len(df)} records")
    print(f"Zero-demand days: {(df['net_quantity'] == 0).sum()}")
    print(f"Holiday spikes: {df['is_holiday'].sum()}")
    
    if output_path:
        df.to_csv(output_path, index=False)
        print(f"Saved to {output_path}")
    
    return df


if __name__ == "__main__":
    generate_test_data("realistic_demand.csv")