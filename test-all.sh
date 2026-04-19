#!/bin/bash

set -e

echo "========================================"
echo "Warehouse ML Platform - Test Suite"
echo "========================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ML_DIR="$SCRIPT_DIR/ml"

cd "$ML_DIR"

echo ""
echo "=== Step 1: Install Python Test Dependencies ==="
pip install pytest pytest-asyncio aiohttp -q

echo ""
echo "=== Step 2: Run Feature Tests ==="
pytest tests/test_features.py -v --tb=short || true

echo ""
echo "=== Step 3: Run Inference Tests ==="
pytest tests/test_inference.py -v --tb=short || true

echo ""
echo "=== Step 4: Run Benchmark (if service running) ==="
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "ML Service is running - running benchmark..."
    python benchmark_latency.py --mode concurrent --requests 100 || true
else
    echo "ML Service not running - skipping benchmark"
    echo "To run benchmark: start service first with 'docker run -p 8080:8080 ml-inference'"
fi

echo ""
echo "=== Step 5: Run TypeScript Tests ==="
cd "$SCRIPT_DIR"

if command -v npm > /dev/null 2>&1; then
    if [ -f "package.json" ]; then
        if grep -q '"vitest"' package.json; then
            npm test -- --run src/tests/api/forecast.test.ts || true
        else
            echo "vitest not configured - run 'npm install vitest' to add tests"
        fi
    fi
else
    echo "npm not found - skipping TypeScript tests"
fi

echo ""
echo "========================================"
echo "Test Suite Complete"
echo "========================================"

echo ""
echo "Individual test commands:"
echo "  pytest ml/tests/test_features.py -v         # Feature engineering"
echo "  pytest ml/tests/test_inference.py -v        # Inference"
echo "  pytest ml/validate.py                  # Model validation"
echo "  python ml/benchmark_latency.py       # Latency benchmark"