import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import sys
sys.path.insert(0, '../')

from train import (
    create_features,
    is_holiday,
    create_holiday_covariates,
    create_time_covariates,
    _add_lag_features,
)


class TestHolidayFlags:
    def test_indian_holidays(self):
        holidays = [
            (datetime(2024, 11, 1), True, "Diwali"),
            (datetime(2024, 3, 25), True, "Holi"),
            (datetime(2024, 8, 15), True, "Independence Day"),
            (datetime(2024, 1, 26), True, "Republic Day"),
            (datetime(2024, 10, 2), True, "Gandhi Jayanti"),
        ]
        
        for date, expected_is_holiday, name in holidays:
            is_h, h_name = is_holiday(date)
            assert is_h == expected_is_holiday, f"{date} should be {name}"
            assert h_name == name, f"Holiday name should be {name}"

    def test_non_holidays(self):
        non_holidays = [
            datetime(2024, 7, 15),
            datetime(2024, 2, 14),
            datetime(2024, 5, 1),
            datetime(2024, 9, 1),
        ]
        
        for date in non_holidays:
            is_h, _ = is_holiday(date)
            assert is_h == False, f"{date} should not be a holiday"

    def test_create_holiday_covariates(self):
        start = datetime(2024, 1, 1)
        end = datetime(2024, 1, 31)
        
        df = create_holiday_covariates(start, end)
        
        assert "date" in df.columns
        assert "holiday_flags" in df.columns
        assert len(df) == 31
        
        holiday_rows = df[df["holiday_flags"] == 1]
        assert len(holiday_rows) >= 1


class TestTimeCovariates:
    def test_time_features_created(self):
        start = datetime(2024, 1, 1)
        end = datetime(2024, 1, 15)
        
        df = create_time_covariates(start, end)
        
        expected_cols = ["date", "day_of_week", "day_of_month", "month", "is_weekend", "quarter"]
        for col in expected_cols:
            assert col in df.columns
        
        assert len(df) == 15
    
    def test_weekend_detection(self):
        df = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=14, freq="D")
        })
        
        result = create_time_covariates(df["date"].min(), df["date"].max())
        
        assert "is_weekend" in result.columns
        
        weekends = result[result["is_weekend"] == 1]
        expected_weekends = 4
        assert len(weekends) == expected_weekends


class TestFeatureEngineering:
    def test_lag_features(self):
        data = {
            "product_id": ["p1"] * 10,
            "date": pd.date_range("2024-01-01", periods=10, freq="D"),
            "net_quantity": [10, 15, 12, 8, 20, 25, 18, 22, 30, 28],
        }
        df = pd.DataFrame(data)
        
        result = _add_lag_features(df)
        
        assert "lag_1d" in result.columns
        assert "lag_7d" in result.columns
        assert "rolling_mean_7d" in result.columns
        assert "rolling_mean_14d" in result.columns
        
        assert result["lag_1d"].iloc[0] == 0
        assert result["lag_1d"].iloc[1] == 10
        
        assert result["rolling_mean_7d"].iloc[7] == pytest.approx(15.0)
    
    def test_create_features(self):
        data = {
            "product_id": ["p1"] * 20,
            "date": pd.date_range("2024-01-01", periods=20, freq="D"),
            "net_quantity": list(range(1, 21)),
        }
        df = pd.DataFrame(data)
        
        result = create_features(df)
        
        assert not result.empty
        assert "lag_1d" in result.columns
        assert "lag_7d" in result.columns
        assert "rolling_mean_7d" in result.columns
        assert "day_of_week" in result.columns
        assert "is_holiday" in result.columns
    
    def test_rolling_mean_calculation(self):
        df = pd.DataFrame({
            "product_id": ["p1"] * 14,
            "date": pd.date_range("2024-01-01", periods=14, freq="D"),
            "net_quantity": [10] * 14,
        })
        
        result = _add_lag_features(df)
        
        for i in range(13, 14):
            assert result["rolling_mean_7d"].iloc[i] == 10.0
            assert result["rolling_mean_14d"].iloc[i] == 10.0
    
    def test_empty_dataframe(self):
        df = pd.DataFrame(columns=["product_id", "date", "net_quantity"])
        
        result = create_features(df)
        
        assert result.empty
    
    def test_missing_columns(self):
        df = pd.DataFrame({
            "product_id": ["p1"],
            "date": [datetime.now()],
        })
        
        result = create_features(df)
        
        assert not result.empty


class TestEdgeCases:
    def test_single_row(self):
        df = pd.DataFrame({
            "product_id": ["p1"],
            "date": [datetime(2024, 1, 1)],
            "net_quantity": [10],
        })
        
        result = _add_lag_features(df)
        
        assert "lag_1d" in result.columns
        assert result["lag_1d"].iloc[0] == 0
    
    def test_all_zeros(self):
        df = pd.DataFrame({
            "product_id": ["p1"] * 7,
            "date": pd.date_range("2024-01-01", periods=7, freq="D"),
            "net_quantity": [0] * 7,
        })
        
        result = _add_lag_features(df)
        
        assert result["rolling_mean_7d"].iloc[-1] == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])