import pytest
import json
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime, timedelta

import sys
sys.path.insert(0, '../')

from inference import (
    check_holiday,
    get_latest_features,
    load_xgboost_model,
    generate_forecast,
    fallback_prediction,
    prepare_features_for_prediction,
)


class MockResponse:
    def __init__(self, data):
        self.data = data
    
    def execute(self):
        return self


class MockStorage:
    def __init__(self, data=None):
        self.data = data or b""
    
    def to_bytes(self):
        return self.data


class TestHolidayUtils:
    def test_check_holiday_diwali(self):
        is_holiday, name = check_holiday(datetime(2024, 11, 1))
        assert is_holiday is True
        assert name == "Diwali"
    
    def test_check_holiday_holi(self):
        is_holiday, name = check_holiday(datetime(2024, 3, 25))
        assert is_holiday is True
        assert name == "Holi"
    
    def test_check_holiday_independence_day(self):
        is_holiday, name = check_holiday(datetime(2024, 8, 15))
        assert is_holiday is True
    
    def test_non_holiday(self):
        is_holiday, name = check_holiday(datetime(2024, 7, 15))
        assert is_holiday is False
        assert name is None


class TestFallbackPrediction:
    def test_fallback_prediction_basic(self):
        features = {
            "rolling_avg_7d": 100,
            "lag_1d": 120,
        }
        
        result = fallback_prediction(features, horizon=7)
        
        assert len(result) == 7
        assert all("predicted_qty" in r for r in result)
        assert all("confidence_lower" in r for r in result)
        assert all("confidence_upper" in r for r in result)
    
    def test_fallback_prediction_zero_base(self):
        features = {
            "rolling_avg_7d": 0,
            "lag_1d": 0,
        }
        
        result = fallback_prediction(features, horizon=3)
        
        assert len(result) == 3
        assert all(r["predicted_qty"] == 0 for r in result)
    
    def test_fallback_prediction_uses_lag(self):
        features = {
            "rolling_avg_7d": 0,
            "lag_1d": 50,
        }
        
        result = fallback_prediction(features, horizon=1)
        
        assert result[0]["predicted_qty"] > 0


class TestPrepareFeatures:
    def test_prepare_features_vector(self):
        features = {
            "lag_1d": 100,
            "lag_7d": 90,
            "rolling_avg_7d": 95,
            "rolling_avg_14d": 85,
            "rolling_std_7d": 10,
        }
        
        forecast_date = datetime(2024, 1, 15)
        
        result = prepare_features_for_prediction(features, forecast_date)
        
        assert result.shape == (1, 10)
        assert result[0][0] == 100
        assert result[0][1] == 90
        assert result[0][2] == 95
        assert result[0][6] == 1
    
    def test_prepare_features_weekend(self):
        features = {
            "lag_1d": 100,
            "lag_7d": 90,
            "rolling_avg_7d": 95,
            "rolling_avg_14d": 85,
            "rolling_std_7d": 10,
        }
        
        saturday = datetime(2024, 1, 13)
        result = prepare_features_for_prediction(features, saturday)
        
        assert result[0][6] == 1


class TestGenerateForecast:
    @patch('inference.get_supabase_client')
    @patch('inference.get_latest_features')
    def test_generate_forecast_success(self, mock_features, mock_client):
        mock_supabase = MagicMock()
        mock_client.return_value = mock_supabase
        
        mock_features.return_value = {
            "product_id": "test-id",
            "rolling_avg_7d": 100,
            "lag_1d": 95,
        }
        
        with patch('inference.load_xgboost_model', return_value=None):
            result = generate_forecast("test-product-id", "xgboost")
        
        assert result["status"] == "success"
        assert result["product_id"] == "test-product-id"
        assert len(result["forecast"]) == 7
    
    @patch('inference.get_supabase_client')
    @patch('inference.get_latest_features')
    def test_generate_forecast_no_features(self, mock_features, mock_client):
        mock_supabase = MagicMock()
        mock_client.return_value = mock_supabase
        
        mock_features.return_value = None
        
        result = generate_forecast("test-product-id", "xgboost")
        
        assert result["status"] == "error"
        assert "No data" in result["message"]
    
    @patch('inference.get_supabase_client')
    @patch('inference.get_latest_features')
    @patch('inference.get_demand_history')
    def test_generate_forecast_fallback_hist(self, mock_history, mock_features, mock_client):
        mock_supabase = MagicMock()
        mock_client.return_value = mock_supabase
        
        mock_features.return_value = None
        mock_history.return_value = MagicMock()
        mock_history.return_value.empty = False
        mock_history.return_value.tail = MagicMock(return_value=MagicMock(mean=MagicMock(return_value=50)))
        
        result = generate_forecast("test-product-id", "xgboost")
        
        assert result["status"] == "success"
        assert result["model_type"] == "fallback"


class TestFastAPIMocking:
    @pytest.fixture
    def mock_supabase(self):
        with patch('main.get_supabase_client') as mock:
            client = MagicMock()
            mock.return_value = client
            yield client
    
    def test_health_endpoint_response(self, mock_supabase):
        from main import health_check
        import asyncio
        
        result = asyncio.run(health_check())
        
        assert "status" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])